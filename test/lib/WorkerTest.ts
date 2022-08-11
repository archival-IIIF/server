import sinon from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';

import {waitForTask, handleMessage} from '../../src/lib/Worker.js';

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
            brPopLPush: sinon.stub().resolves(undefined),
        };

        redisMulti = {
            lRem: () => redisMulti,
            del: () => redisMulti,
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

            expect(redis.brPopLPush).to.be.calledOnce;
            expect(redis.brPopLPush).to.be.calledWithExactly('tasks:test', 'tasks:test:progress', 0);
        });
    });

    describe('#handleMessage()', () => {
        const taskData = {identifier: '123', data: {echo: 'Hello!'}};
        const echoTask = async (params: { echo: string }) => params.echo;

        it('should publish the result of a task', async () => {
            await handleMessage('test', taskData, JSON.stringify(taskData), echoTask, redis);

            expect(redisMulti.publish).to.be.calledWithExactly('tasks:test', JSON.stringify({
                identifier: taskData.identifier,
                data: await echoTask(taskData.data)
            }));
        });
    });
});
