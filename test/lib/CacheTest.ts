import sinon from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';

import {setRedisClient} from '../../src/lib/Redis.js';
import {cache, evictCache} from '../../src/lib/Cache.js';

chai.use(sinonChai);
const expect = chai.expect;

describe('Cache', () => {
    let redis: any;
    let redisMulti: any;
    let contentFunc: any;

    const cacheable = {thisIs: 'to be cached'};

    beforeEach(() => {
        redis = {
            del: sinon.spy(),
            get: sinon.stub().resolves(null as any),
            sMembers: sinon.stub().resolves([]),
            multi: () => redisMulti
        };

        redisMulti = {
            sAdd: sinon.stub().returnsThis(),
            set: sinon.stub().returnsThis(),
            exec: sinon.fake()
        };

        contentFunc = sinon.spy(() => cacheable);

        setRedisClient(redis);
    });

    afterEach(() => {
        sinon.restore();
        setRedisClient(null);
    });

    describe('#cache()', () => {
        it('should cache new data', async () => {
            const contentCached = await cache('type', 'group', 'id', contentFunc);

            expect(contentFunc).to.have.been.calledOnce;
            expect(contentCached).to.be.deep.equal(cacheable);

            expect(redis.get).to.have.been.calledWith('type:group:id');
            expect(redisMulti.set).to.have.been.calledWith('type:group:id', JSON.stringify(cacheable), sinon.match.any);
            expect(redisMulti.sAdd).to.have.been.calledWith('type:group', 'type:group:id');
        });

        it('should obtain cached data', async () => {
            redis.get.resolves(JSON.stringify(cacheable));

            const contentCached = await cache('type', 'group', 'id', contentFunc);

            expect(contentFunc).to.have.not.been.called;
            expect(contentCached).to.be.deep.equal(cacheable);

            expect(redis.get).to.be.calledWith('type:group:id');
            expect(redisMulti.set).to.have.not.been.called;
            expect(redisMulti.sAdd).to.have.not.been.called;
        });
    });

    describe('#evictCache()', () => {
        it('should evict the cache', async () => {
            redis.sMembers.resolves(['key1', 'key2', 'key3']);

            await evictCache('type', 'group');

            expect(redis.sMembers).to.have.been.calledWith('type:group');
            expect(redis.del).to.have.been.calledWith(['type:group', 'key1', 'key2', 'key3']);
        });
    });
});
