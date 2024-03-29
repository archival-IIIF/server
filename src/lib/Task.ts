import logger from './Logger.js';
import {workersRunning, libsRunning} from './Service.js';
import {getPersistentClient} from './Redis.js';

export function runTask<T>(type: string, task: T): void {
    if (type in workersRunning) {
        const service = workersRunning[type];
        service.loadService().then(service =>
            service(task).catch((err: any) =>
                logger.error(`Failure during task with type '${type}'`, {err})));
        return;
    }

    const client = getPersistentClient();
    if (!client)
        throw new Error('A persistent Redis server is required for sending tasks to workers!');

    logger.debug(`Sending a new task with type '${type}'`);
    client.rPush(`tasks:${type}`, JSON.stringify(task));
}

export async function runLib<P, R>(type: string, params: P): Promise<R> {
    if (!(type in libsRunning))
        throw new Error(`No lib found of type '${type}'`);

    const service = await libsRunning[type].loadService();
    return service(params);
}
