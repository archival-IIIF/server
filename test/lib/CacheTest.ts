import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

import {setConfig} from '../../src/lib/Config';
import {setRedisClient} from '../../src/lib/Redis';
import {cache, evictCache} from '../../src/lib/Cache';

chai.use(sinonChai);
const expect = chai.expect;

describe('Cache', () => {
    let redis: any;
    let contentFunc: sinon.SinonStub;

    const cacheable = {thisIs: 'to be cached'};

    beforeEach(() => {
        redis = {
            sadd: sinon.spy(),
            del: sinon.spy(),

            get: sinon.stub().resolves(null as any),
            set: sinon.stub().resolves('OK'),
            smembers: sinon.stub().resolves([])
        };

        contentFunc = sinon.stub().resolves(cacheable);

        setConfig('cacheDisabled', false);
        setRedisClient(redis);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('#cache()', () => {
        it('should cache new data', async () => {
            const contentCached = await cache('type', 'group', 'id', contentFunc);

            expect(contentFunc).to.have.been.calledOnce;
            expect(contentCached).to.be.deep.equal(cacheable);

            expect(redis.get).to.have.been.calledWith('type:group:id');
            expect(redis.set).to.have.been.calledWith('type:group:id', JSON.stringify(cacheable), sinon.match.any);
            expect(redis.sadd).to.have.been.calledWith('type:group', 'type:group:id');
        });

        it('should obtain cached data', async () => {
            redis.get.resolves(JSON.stringify(cacheable));

            const contentCached = await cache('type', 'group', 'id', contentFunc);

            expect(contentFunc).to.have.not.been.called;
            expect(contentCached).to.be.deep.equal(cacheable);

            expect(redis.get).to.be.calledWith('type:group:id');
            expect(redis.set).to.have.not.been.called;
            expect(redis.sadd).to.have.not.been.called;
        });
    });

    describe('#evictCache()', () => {
        it('should evict the cache', async () => {
            redis.smembers.resolves(['key1', 'key2', 'key3']);

            await evictCache('type', 'group');

            expect(redis.smembers).to.have.been.calledWith('type:group');
            expect(redis.del).to.have.been.calledWith('type:group', 'key1', 'key2', 'key3');
        });
    });
});
