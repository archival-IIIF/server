import sinon from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';

import {waitForTask} from '../../src/lib/Worker.js';

chai.use(sinonChai);
const expect = chai.expect;

describe('Worker', () => {
    let redis: any;
    let redisMulti: any;

    beforeEach(() => {
        redis = {
            multi: () => redisMulti,
            setEx: sinon.stub(),
            lRem: sinon.spy(),
            blMove: sinon.stub().resolves(undefined),
        };

        redisMulti = {
            publish: sinon.stub().returns(redisMulti),
            exec: sinon.fake(),
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('#waitForTask()', () => {
        it('should monitor a queue', () => {
            waitForTask('test', async () => null, [], redis, redis);

            expect(redis.blMove).to.be.calledOnce;
            expect(redis.blMove).to.be.calledWithExactly('tasks:test', 'tasks:test:progress', 'RIGHT', 'LEFT', 0);
        });
    });
});
