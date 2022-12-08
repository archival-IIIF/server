import config from './Config.js';
import logger from './Logger.js';

import {createClient, RedisClientType} from 'redis';
import {RedisSocketOptions} from '@redis/client/dist/lib/client/socket.js';

let testClient: RedisClientType | null = null;
const volatileClient = (config.redisVolatile !== null && config.env !== 'test')
    ? createNewVolatileClient('volatile') : null;
const persistentClient = (config.redisPersistent !== null && config.env !== 'test')
    ? createNewPersistentClient('persistent') : null;

export function getVolatileClient(): RedisClientType | null {
    if (config.env === 'test' && testClient)
        return testClient;

    return volatileClient;
}

export function getPersistentClient(): RedisClientType | null {
    if (config.env === 'test' && testClient)
        return testClient;

    return persistentClient;
}

export function createNewVolatileClient(name: string): RedisClientType {
    if (config.redisVolatile === null)
        throw new Error('A volatile Redis server is required for using the cache functionality!');

    if (config.env === 'test' && testClient)
        return testClient;

    return createClientWithSocketOptions(name, config.redisVolatile);
}

export function createNewPersistentClient(name: string): RedisClientType {
    if (config.redisPersistent === null)
        throw new Error('A persistent Redis server is required for using the worker or auth functionality!');

    if (config.env === 'test' && testClient)
        return testClient;

    return createClientWithSocketOptions(name, config.redisPersistent);
}

// For test purposes
export function setRedisClient(client: RedisClientType | null): void {
    if (config.env === 'test')
        testClient = client;
}


function createClientWithSocketOptions(name: string, redisSocketOptions: RedisSocketOptions): RedisClientType {
    const client: RedisClientType = createClient({
        socket: {
            //reconnectStrategy: retries => Math.min(retries * 100, 3000),
            ...redisSocketOptions
        }
    });

    if (config.env !== 'test') {
        client.on('reconnecting', () => logger.debug(`Redis ${name}: reconnecting`));
        client.on('error', err => logger.error(`Redis ${name} error: ${err.message}`, {err}));
    }

    return client;
}

(async function connect() {
    try {
        if (volatileClient) {
            await volatileClient.connect();
            await volatileClient.ping();
        }

        if (persistentClient) {
            await persistentClient.connect();
            await persistentClient.ping();
        }
    }
    catch (e) {
        connect();
    }
})();
