import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

import {setRedisClient} from '../../src/lib/Redis';
import {setServicesRunning} from '../../src/lib/Service';

import {runTask, runTaskWithResponse} from '../../src/lib/Task';

chai.use(sinonChai);
const expect = chai.expect;

describe('Task', () => {
    let redis: any;

    beforeEach(() => {
        redis = {
            rpush: sinon.spy(),
            redis: {
                subscribe: sinon.spy(),
                unsubscribe: sinon.spy(),
                end: sinon.spy(),
                on: sinon.stub().yieldsAsync('tasks:not-local-test', JSON.stringify({
                    identifier: '123',
                    data: 'Hello!'
                })),
            }
        };

        setRedisClient(redis);
        setServicesRunning([{
            name: 'test',
            type: 'local-test',
            runAs: 'lib',
            getService: () => async (params: { echo: string }) => params.echo
        }]);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('#runTask()', () => {
        it('should run local tasks; do not send to queue', async () => {
            await runTask('local-test', {echo: 'Hello!'}, '123');
            expect(redis.rpush).to.have.not.been.called;
        });

        it('should send remote tasks to the queue', async () => {
            await runTask('not-local-test', {echo: 'Hello!'}, '123');
            expect(redis.rpush).to.have.been.calledOnce;
        });

        it('should send unknown tasks to the queue', async () => {
            await runTask('not-existing-test', {echo: 'Hello!'}, '123');
            expect(redis.rpush).to.have.been.calledOnce;
        });
    });

    describe('#runTaskWithResponse()', () => {
        it('should run local tasks; do not send to queue', async () => {
            const response = await runTaskWithResponse('local-test', {echo: 'Hello!'}, '123');
            expect(redis.rpush).to.have.not.been.called;
            expect(response).to.equal('Hello!');
        });

        it('should send remote tasks to the queue', async () => {
            const response = await runTaskWithResponse('not-local-test', {echo: 'Hello!'}, '123');
            expect(redis.rpush).to.have.been.calledOnce;
            expect(response).to.equal('Hello!');
        });

        it('should send unknown tasks to the queue and timeout', async () => {
            const response = await runTaskWithResponse('not-existing-test', {echo: 'Hello!'}, '123')
                .then(null, (err: Error) => err);
            expect(response).to.be.an('error');
            expect(redis.rpush).to.have.been.calledOnce;
        }).timeout(6000);
    });
});
