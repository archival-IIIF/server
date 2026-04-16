import sinon from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';

import {runTask} from '../../src/lib/Task.ts';
import {setRedisClient} from '../../src/lib/Redis.ts';
import {setWorkersRunning} from '../../src/lib/Service.ts';

chai.use(sinonChai);
const expect = chai.expect;

describe('Task', () => {
    let redis: any;

    beforeEach(() => {
        redis = {
            connect: sinon.fake(),
            rPush: sinon.spy(),
            disconnect: sinon.spy()
        };

        setRedisClient(redis);
        setWorkersRunning({
            'local-test': {
                name: 'test',
                loadService: async () => async (params: { echo: string }) => params.echo
            }
        });
    });

    afterEach(() => {
        sinon.restore();

        setRedisClient(null);
    });

    describe('#runTask()', () => {
        it('should run local tasks; do not send to queue', async () => {
            await runTask('local-test', {echo: 'Hello!'});
            expect(redis.rPush).to.have.not.been.called;
        });

        it('should send remote or unknown tasks to the queue', async () => {
            await runTask('not-local-test', {echo: 'Hello!'});
            expect(redis.rPush).to.have.been.calledOnce;
        });
    });
});
