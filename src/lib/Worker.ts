import {getClient, createNewClient} from './Redis';
import {RedisMessage} from './Task';
import logger from './Logger';
import {IHandyRedis} from 'handy-redis';

export default function onTask<A, R>(type: string, process: (args: A) => Promise<R>,
                                     blockingClient = createNewClient()): void {
    const client = getClient();
    if (!client)
        throw new Error('Redis is required for for setting up workers!');

    logger.debug(`Waiting for a new task with type '${type}'`);

    blockingClient.blpop(['tasks:' + type], 0).then(async (msg: string[] | undefined) => {
        if (!client)
            throw new Error('Redis is required for for setting up workers!');

        if (msg !== undefined) {
            onTask(type, process, blockingClient);

            const task = JSON.parse(msg[1]) as RedisMessage<A>;
            await handleMessage(type, task, process, client);
        }
    }).catch(err => {
        logger.error(`Failure loading a new task with type '${type}'`, {err});
        onTask(type, process, blockingClient);
    });
}

export async function handleMessage<A, R>(type: string, task: RedisMessage<A>,
                                          process: (args: A) => Promise<R>, client: IHandyRedis): Promise<void> {
    try {
        logger.debug(`Received a new task with type '${type}' and identifier '${task.identifier}'`);

        const noAdded = await client.sadd('tasks:' + type + ':progress', task.identifier);
        if (noAdded !== 1) {
            logger.debug(`Task with type '${type}' and identifier '${task.identifier}' is already added to the progress list`);
            return;
        }

        logger.debug(`Start progress on task with type '${type}' and identifier '${task.identifier}'`);
        const data = task.data;
        const result = await process(data);
        logger.debug(`Finished progress on task with type '${type}' and identifier '${task.identifier}'`);

        await client.execMulti(
            client.multi()
                .srem('tasks:' + type + ':progress', task.identifier)
                .publish('tasks:' + type, JSON.stringify({identifier: task.identifier, data: result}))
        );
    }
    catch (err) {
        await client.srem('tasks:' + type + ':progress', task.identifier);
        logger.error(`Failure during task with type '${type}' and identifier '${task.identifier}'`, {err});
    }
}