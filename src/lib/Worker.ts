import {promisify} from 'util';
import {WrappedNodeRedisClient} from 'handy-redis';

import config from './Config';
import logger from './Logger';
import {RedisMessage} from './Task';
import getEsClient from './ElasticSearch';
import {getPersistentClient, createNewPersistentClient} from './Redis';
import registerGracefulShutdownHandler from './GracefulShutdown';
import {allServices, servicesRunning} from './Service';

type WorkerStatus = { waiting: RedisMessage<any>[], working: RedisMessage<any>[] };
type WorkerStatusType = { type: string } & WorkerStatus;

const sleep = promisify(setTimeout);
let shutdown = false;

export async function workerStatus(): Promise<{ [type: string]: WorkerStatus }> {
    const client = getPersistentClient();
    if (!client)
        throw new Error('A persistent Redis server is required for for workers!');

    const results = await Promise.all(allServices
        .filter(service => service.runAs === 'worker')
        .filter(service => !servicesRunning.find(running => running.name === service.name))
        .map(async service => {
            const nameQueue = 'tasks:' + service.type;
            const nameProgressList = 'tasks:' + service.type + ':progress';

            const tasksInQueue = await client.lrange(nameQueue, 0, -1);
            const tasksInProgress = await client.lrange(nameProgressList, 0, -1);

            return {
                type: service.type,
                waiting: tasksInQueue.map(json => JSON.parse(json) as RedisMessage<any>),
                working: tasksInProgress.map(json => JSON.parse(json) as RedisMessage<any>)
            };
        }));

    return results.reduce((acc: { [type: string]: WorkerStatus }, result: WorkerStatusType) => {
        acc[result.type] = {waiting: result.waiting, working: result.working};
        return acc;
    }, {});
}

export default async function onTask<A, R>(type: string, process: (args: A) => Promise<R>): Promise<void> {
    const client = getPersistentClient();
    const blockingClient = createNewPersistentClient();
    const tasksInProgress: string[] = [];

    if (!client || !blockingClient)
        throw new Error('A persistent Redis server is required for for setting up workers!');

    await waitForReady(client);
    await moveExpiredTasksToQueue(type, client);

    registerGracefulShutdownHandler(async () =>
        await gracefulShutdown(type, tasksInProgress, client, blockingClient));

    waitForTask(type, process, tasksInProgress, client, blockingClient);
}

async function waitForReady(client: WrappedNodeRedisClient): Promise<void> {
    try {
        await client.ping();
        await getEsClient().ping();

        logger.debug('Both Redis and ElasticSearch are now ready');
    }
    catch (e) {
        await sleep(1000);
        await waitForReady(client);
    }
}

export async function moveExpiredTasksToQueue<A>(type: string, client: WrappedNodeRedisClient): Promise<void> {
    try {
        const nameQueue = 'tasks:' + type;
        const nameProgressList = 'tasks:' + type + ':progress';

        const tasksInProgress = await client.lrange(nameProgressList, 0, -1);
        const expiredTasks = await Promise.all(tasksInProgress.map(async msg => {
            const task = JSON.parse(msg) as RedisMessage<A>;
            const hasNotExpired = await client.get('tasks:' + type + ':' + task.identifier);

            return hasNotExpired ? null : msg;
        }));

        const filteredExpiredTasks = expiredTasks.filter(task => task !== null) as string[];
        if (filteredExpiredTasks.length > 0)
            await client.rpush(nameQueue, ...filteredExpiredTasks);
    }
    catch (err) {
        logger.error(`Failure moving expired tasks with type '${type}' back to the queue`, {err});
    }
}

export async function gracefulShutdown<A>(type: string, tasksInProgress: string[],
                                          client: WrappedNodeRedisClient,
                                          blockingClient: WrappedNodeRedisClient): Promise<void> {
    try {
        shutdown = true;
        blockingClient.nodeRedis.end(true);

        if (tasksInProgress.length > 0) {
            logger.debug('Tasks found!');

            const nameQueue = 'tasks:' + type;
            const nameProgressList = 'tasks:' + type + ':progress';

            let multi: any = client.multi().rpush(nameQueue, ...tasksInProgress);

            for (const task of tasksInProgress) {
                multi = multi.lrem(nameProgressList, 1, task);

                const taskParsed = JSON.parse(task) as RedisMessage<A>;
                multi = multi.del(nameQueue + ':' + taskParsed.identifier);
            }

            await multi.exec();
        }
    }
    catch (err) {
        logger.error('Cannot move running tasks back to the queue', {err});
    }
}

export async function waitForTask<A, R>(type: string, process: (args: A) => Promise<R>, tasksInProgress: string[],
                                        client: WrappedNodeRedisClient,
                                        blockingClient: WrappedNodeRedisClient): Promise<void> {
    try {
        while (tasksInProgress.length >= config.maxTasksPerWorker) {
            logger.debug('Too many tasks running; waiting to continue...');
            await sleep(500);
        }

        logger.debug(`Waiting for a new task with type '${type}'`);

        const nameQueue = 'tasks:' + type;
        const nameProgressList = 'tasks:' + type + ':progress';

        const msg = await blockingClient.brpoplpush(nameQueue, nameProgressList, 0);
        if (msg) {
            tasksInProgress.push(msg);
            waitForTask(type, process, tasksInProgress, client, blockingClient);

            const task = JSON.parse(msg) as RedisMessage<A>;
            await handleMessage(type, task, msg, process, client);

            tasksInProgress.splice(tasksInProgress.indexOf(msg), 1);
        }
    }
    catch (err) {
        if (!shutdown) {
            logger.error(`Failure loading a new task with type '${type}'`, {err});
            waitForTask(type, process, tasksInProgress, client, blockingClient);
        }
    }
}

export async function handleMessage<A, R>(type: string, task: RedisMessage<A>, msg: string,
                                          process: (args: A) => Promise<R>,
                                          client: WrappedNodeRedisClient): Promise<void> {
    try {
        logger.debug(`Received a new task with type '${type}' and identifier '${task.identifier}' and data ${JSON.stringify(task.data)}`);

        const nameQueue = 'tasks:' + type;
        const nameProgressList = 'tasks:' + type + ':progress';
        const nameExpiration = 'tasks:' + type + ':' + task.identifier;

        await client.setex(nameExpiration, 60 * 5, task.identifier);

        const result = await process(task.data);

        await client
            .multi()
            .del(nameExpiration)
            .lrem(nameProgressList, 1, msg)
            .publish(nameQueue, JSON.stringify({identifier: task.identifier, data: result}))
            .exec();

        logger.debug(`Finished task with type '${type}' and identifier '${task.identifier}' and data ${JSON.stringify(task.data)}`);
    }
    catch (err) {
        await client.lrem('tasks:' + type + ':progress', 1, JSON.stringify(task));
        logger.error(`Failure during task with type '${type}' and identifier '${task.identifier}' and data ${JSON.stringify(task.data)}`, {err});
    }
}