import {promisify} from 'node:util'
import {createHash} from 'node:crypto';
import {RedisClientType} from 'redis';

import config from './Config.js';
import logger from './Logger.js';
import getEsClient from './ElasticSearch.js';
import {allServices, workersRunning} from './Service.js';
import registerGracefulShutdownHandler from './GracefulShutdown.js';
import {getPersistentClient, createNewPersistentClient} from './Redis.js';

type WorkerStatus<T> = { waiting: T[], working: T[] };
type WorkerStatusType<T> = { type: string } & WorkerStatus<T>;

let shutdown = false;
const sleep = promisify(setTimeout);
const hash = (str: string): string => createHash('md5').update(str).digest('hex');

export async function workerStatus(): Promise<{ [type: string]: WorkerStatus<any> }> {
    const client = getPersistentClient();
    if (!client)
        throw new Error('A persistent Redis server is required for workers!');

    const results = await Promise.all(allServices
        .filter(service => service.runAs === 'worker')
        .filter(service => !(service.type in workersRunning))
        .map(async service => {
            const nameQueue = 'tasks:' + service.type;
            const nameProgressList = 'tasks:' + service.type + ':progress';

            const tasksInQueue = await client.lRange(nameQueue, 0, -1);
            const tasksInProgress = await client.lRange(nameProgressList, 0, -1);

            return {
                type: service.type,
                waiting: tasksInQueue.map(json => JSON.parse(json)),
                working: tasksInProgress.map(json => JSON.parse(json))
            };
        }));

    return results.reduce((acc: { [type: string]: WorkerStatus<any> }, result: WorkerStatusType<any>) => {
        acc[result.type] = {waiting: result.waiting, working: result.working};
        return acc;
    }, {});
}

export async function onTask<A, R>(type: string, process: (args: A) => Promise<R>): Promise<void> {
    const client = getPersistentClient();
    const blockingClient = createNewPersistentClient('blocking');
    const tasksInProgress: string[] = [];

    if (!client || !blockingClient)
        throw new Error('A persistent Redis server is required for for setting up workers!');

    await waitForReady(client);
    await moveExpiredTasksToQueue(type, client);

    await blockingClient.connect();

    registerGracefulShutdownHandler(async () =>
        gracefulShutdown(type, tasksInProgress, client, blockingClient));

    waitForTask(type, process, tasksInProgress, client, blockingClient);
}

async function waitForReady(client: RedisClientType): Promise<void> {
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

export async function moveExpiredTasksToQueue<A>(type: string, client: RedisClientType): Promise<void> {
    try {
        const nameQueue = 'tasks:' + type;
        const nameProgressList = 'tasks:' + type + ':progress';

        const tasksInProgress = await client.lRange(nameProgressList, 0, -1);
        const expiredTasks = await Promise.all(tasksInProgress.map(async msg => {
            const hasNotExpired = await client.get('tasks:' + type + ':' + hash(msg));
            return hasNotExpired ? null : msg;
        }));

        const filteredExpiredTasks = expiredTasks.filter(task => task !== null) as string[];
        if (filteredExpiredTasks.length > 0)
            await client.rPush(nameQueue, filteredExpiredTasks);
    }
    catch (err) {
        logger.error(`Failure moving expired tasks with type '${type}' back to the queue`, {err});
    }
}

export async function gracefulShutdown(type: string, tasksInProgress: string[],
                                       client: RedisClientType, blockingClient: RedisClientType): Promise<void> {
    try {
        shutdown = true;
        await blockingClient.disconnect();

        if (tasksInProgress.length > 0) {
            logger.debug('Tasks found!');

            const nameQueue = 'tasks:' + type;
            const nameProgressList = 'tasks:' + type + ':progress';

            let multi: any = client.multi().rPush(nameQueue, tasksInProgress);

            for (const task of tasksInProgress) {
                multi = multi.lrem(nameProgressList, 1, task);
                multi = multi.del(nameQueue + ':' + hash(task));
            }

            await multi.exec();
        }
    }
    catch (err) {
        logger.error('Cannot move running tasks back to the queue', {err});
    }
}

export async function waitForTask<A, R>(type: string, process: (args: A) => Promise<R>, tasksInProgress: string[],
                                        client: RedisClientType, blockingClient: RedisClientType): Promise<void> {
    try {
        while (tasksInProgress.length >= config.maxTasksPerWorker) {
            logger.debug('Too many tasks running; waiting to continue...');
            await sleep(500);
        }

        logger.debug(`Waiting for a new task with type '${type}'`);

        const nameQueue = 'tasks:' + type;
        const nameProgressList = 'tasks:' + type + ':progress';

        const msg = await blockingClient.blMove(nameQueue, nameProgressList, 'RIGHT', 'LEFT', 0);
        if (msg) {
            tasksInProgress.push(msg);
            waitForTask(type, process, tasksInProgress, client, blockingClient);

            await handleMessage(type, msg, process, client);

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

export async function handleMessage<A, R>(type: string, msg: string, process: (args: A) => Promise<R>,
                                          client: RedisClientType): Promise<void> {
    try {
        const task = JSON.parse(msg) as A;
        logger.debug(`Received a new task with type '${type}' and data ${msg}`);

        const nameProgressList = 'tasks:' + type + ':progress';
        const nameExpiration = 'tasks:' + type + ':' + hash(msg);

        await client.setEx(nameExpiration, 60 * 5, hash(msg));
        await process(task);

        await client
            .multi()
            .del(nameExpiration)
            .lRem(nameProgressList, 1, msg)
            .exec();

        logger.debug(`Finished task with type '${type}' and data ${msg}`);
    }
    catch (err) {
        await client.lRem('tasks:' + type + ':progress', 1, msg);
        logger.error(`Failure during task with type '${type}' and data ${msg}`, {err});
    }
}