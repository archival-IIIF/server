import {IHandyRedis} from 'handy-redis';

import logger from './Logger';
import {RedisMessage} from './Task';
import {getClient, createNewClient} from './Redis';

export default async function onTask<A, R>(type: string, process: (args: A) => Promise<R>): Promise<void> {
    const client = getClient();
    const blockingClient = createNewClient();

    if (!client || !blockingClient)
        throw new Error('Redis is required for for setting up workers!');

    await moveExpiredTasksToQueue(type, client);

    waitForTask(type, process, client, blockingClient);
}

export async function moveExpiredTasksToQueue<A>(type: string, client: IHandyRedis): Promise<void> {
    try {
        const nameQueue = 'tasks:' + type;
        const nameProgressList = 'tasks:' + type + ':progress';

        const tasksInProgress = await client.lrange(nameProgressList, 0, -1);
        const expiredTasks = await Promise.all(tasksInProgress.map(async msg => {
            const task = JSON.parse(msg) as RedisMessage<A>;
            const hasNotExpired = await client.get('tasks:' + type + ':' + task.identifier);

            return hasNotExpired ? null : msg;
        }));

        const filteredExpiredTasks = expiredTasks.filter(task => task !== null);
        if (filteredExpiredTasks.length > 0)
            await client.rpush(nameQueue, ...filteredExpiredTasks);
    }
    catch (err) {
        logger.error(`Failure moving expired tasks with type '${type}' back to the queue`, {err});
    }
}

export async function waitForTask<A, R>(type: string, process: (args: A) => Promise<R>,
                                        client: IHandyRedis, blockingClient: IHandyRedis): Promise<void> {
    try {
        logger.debug(`Waiting for a new task with type '${type}'`);

        const nameQueue = 'tasks:' + type;
        const nameProgressList = 'tasks:' + type + ':progress';

        const msg = await blockingClient.brpoplpush(nameQueue, nameProgressList, 0);
        if (msg !== undefined) {
            waitForTask(type, process, client, blockingClient);

            const task = JSON.parse(msg) as RedisMessage<A>;
            await handleMessage(type, task, msg, process, client);
        }
    }
    catch (err) {
        logger.error(`Failure loading a new task with type '${type}'`, {err});
        waitForTask(type, process, client, blockingClient);
    }
}

export async function handleMessage<A, R>(type: string, task: RedisMessage<A>, msg: string,
                                          process: (args: A) => Promise<R>, client: IHandyRedis): Promise<void> {
    try {
        logger.debug(`Received a new task with type '${type}' and identifier '${task.identifier}' and data ${JSON.stringify(task.data)}`);

        const nameQueue = 'tasks:' + type;
        const nameProgressList = 'tasks:' + type + ':progress';
        const nameExpiration = 'tasks:' + type + ':' + task.identifier;

        await client.setex(nameExpiration, 60 * 5, task.identifier);

        const result = await process(task.data);

        await client.execMulti(
            client.multi()
                .lrem(nameProgressList, 1, msg)
                .publish(nameQueue, JSON.stringify({identifier: task.identifier, data: result}))
        );

        logger.debug(`Finished task with type '${type}' and identifier '${task.identifier}' and data ${JSON.stringify(task.data)}`);
    }
    catch (err) {
        await client.lrem('tasks:' + type + ':progress', 1, JSON.stringify(task));
        logger.error(`Failure during task with type '${type}' and identifier '${task.identifier}' and data ${JSON.stringify(task.data)}`, {err});
    }
}