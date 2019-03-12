import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

import {setRedisClient} from '../../src/lib/Redis';

import onTask from '../../src/lib/Worker';
import {handleMessage} from '../../src/lib/Worker';

chai.use(sinonChai);
const expect = chai.expect;

describe('Worker', () => {
    let redis: any;
    let redisMulti: any;

    beforeEach(() => {
        redis = {
            multi: () => redisMulti,
            execMulti: sinon.fake(),
            srem: sinon.spy(),
            blpop: sinon.stub().resolves(undefined),
            sadd: sinon.stub()
                .onFirstCall().resolves(1)
                .onSecondCall().resolves(0),
        };

        redisMulti = {
            srem: () => redisMulti,
            publish: sinon.stub().returns(redisMulti)
        };

        setRedisClient(redis);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('#onTask()', () => {
        it('should monitor a queue', () => {
            onTask('test', async () => null);

            expect(redis.blpop).to.be.calledOnce;
            expect(redis.blpop).to.be.calledWithExactly(['tasks:test'], 0);
        });
    });

    describe('#handleMessage()', () => {
        const taskData = {identifier: '123', data: {echo: 'Hello!'}};
        const echoTask = async (params: { echo: string }) => params.echo;

        it('should publish the result of a task', async () => {
            await handleMessage('test', taskData, echoTask, redis);

            expect(redisMulti.publish).to.be.calledWithExactly('tasks:test', JSON.stringify({
                identifier: taskData.identifier,
                data: await echoTask(taskData.data)
            }));
        });

        it('should ignore tasks already taken by another worker', async () => {
            await handleMessage('test', taskData, echoTask, redis);
            await handleMessage('test', taskData, echoTask, redis);

            expect(redisMulti.publish).to.be.calledOnce;
        });
    });
});
