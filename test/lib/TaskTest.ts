import sinon from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';

import {setRedisClient} from '../../src/lib/Redis.js';
import {setServicesRunning} from '../../src/lib/Service.js';

import {runTask, runTaskWithResponse} from '../../src/lib/Task.js';

chai.use(sinonChai);
const expect = chai.expect;

describe('Task', () => {
    let redis: any;

    beforeEach(() => {
        redis = {
            connect: sinon.fake(),
            rPush: sinon.spy(),
            subscribe: sinon.stub().yieldsAsync(JSON.stringify({
                identifier: '123',
                data: 'Hello!'
            }), 'tasks:not-local-test'),
            unsubscribe: sinon.spy(),
            disconnect: sinon.spy()
        };

        setRedisClient(redis);
        setServicesRunning([{
            name: 'test',
            type: 'local-test',
            runAs: 'lib',
            getService: async () => async (params: { echo: string }) => params.echo
        }]);
    });

    afterEach(() => {
        sinon.restore();

        setRedisClient(null);
    });

    describe('#runTask()', () => {
        it('should run local tasks; do not send to queue', async () => {
            await runTask('local-test', {echo: 'Hello!'}, '123');
            expect(redis.rPush).to.have.not.been.called;
        });

        it('should send remote tasks to the queue', async () => {
            await runTask('not-local-test', {echo: 'Hello!'}, '123');
            expect(redis.rPush).to.have.been.calledOnce;
        });

        it('should send unknown tasks to the queue', async () => {
            await runTask('not-existing-test', {echo: 'Hello!'}, '123');
            expect(redis.rPush).to.have.been.calledOnce;
        });
    });

    describe('#runTaskWithResponse()', () => {
        it('should run local tasks; do not send to queue', async () => {
            const response = await runTaskWithResponse('local-test', {echo: 'Hello!'}, '123');
            expect(redis.rPush).to.have.not.been.called;
            expect(response).to.equal('Hello!');
        });

        it('should send remote tasks to the queue', async () => {
            const response = await runTaskWithResponse('not-local-test', {echo: 'Hello!'}, '123');
            expect(redis.rPush).to.have.been.calledOnce;
            expect(response).to.equal('Hello!');
        });

        it('should send unknown tasks to the queue and timeout', async () => {
            const response = await runTaskWithResponse('not-existing-test', {echo: 'Hello!'}, '123')
                .then(null, (err: Error) => err);
            expect(response).to.be.an('error');
            expect(redis.rPush).to.have.been.calledOnce;
        }).timeout(6000);
    });
});
