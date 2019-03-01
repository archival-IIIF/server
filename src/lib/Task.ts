import * as uuid from 'uuid/v1';
import logger from './Logger';
import {client, createNewClient} from './Redis';
import {ArgService, servicesRunning} from './Service';

export interface RedisMessage<T> {
    identifier: string;
    data: T;
}

const getChannel = (type: string): string => `tasks:${type}`;
const getServiceByType = (type: string): ArgService =>
    servicesRunning.find(service => (service.type === type) && (service.runAs === 'lib')) as ArgService;

export function runTask<T>(type: string, task: T, identifier: string = uuid()): void {
    const service = getServiceByType(type);
    if (service && service.getService) {
        service.getService()(task)
            .catch(err => logger.error(`Failure during task with type '${type}' and identifier '${identifier}'`, {err}));
        return;
    }

    if (!client)
        throw new Error('Redis is required for sending tasks to workers!');

    logger.debug(`Sending a new task with type '${type}' and identifier '${identifier}'`);
    client.rpush(getChannel(type), JSON.stringify({identifier: identifier, data: task}));
}

export function runTaskWithResponse<T, R>(type: string, task: T, identifier: string = uuid()): Promise<R> {
    const service = getServiceByType(type);
    if (service && service.getService)
        return service.getService()<T, R>(task);

    if (!client)
        throw new Error('Redis is required for sending tasks to workers!');

    const timeout = 5000;
    const subscriber = createNewClient();

    return new Promise<R>((resolve, reject) => {
        subscriber.redis.subscribe(getChannel(type));
        subscriber.redis.on('message', (ch, message) => {
            const msg = JSON.parse(message) as RedisMessage<R>;
            if ((ch === getChannel(type)) && (msg.identifier === identifier)) {
                clearTimeout(timer);

                subscriber.redis.unsubscribe();
                subscriber.redis.end(true);

                logger.debug(`Task with type '${type}' and identifier '${identifier}' has finished`);
                resolve(msg.data);
            }
        });

        const timer = setTimeout(() => {
            subscriber.redis.unsubscribe();
            subscriber.redis.end(true);

            reject(new Error(`Task of type ${type} with identifier ${identifier} timed out`));
        }, timeout);

        runTask<T>(type, task, identifier);
    });
}
