import config from './Config.js';
import {createClient, RedisClientType} from 'redis';
import {RedisSocketOptions} from '@redis/client/dist/lib/client/socket.js';

let testClient: RedisClientType | null = null;
const volatileClient = (config.redisVolatile !== null && config.env !== 'test') ? createNewVolatileClient() : null;
const persistentClient = (config.redisPersistent !== null && config.env !== 'test') ? createNewPersistentClient() : null;

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

export function createNewVolatileClient(): RedisClientType {
    if (config.redisVolatile === null)
        throw new Error('A volatile Redis server is required for using the cache functionality!');

    if (config.env === 'test' && testClient)
        return testClient;

    return createClientWithSocketOptions(config.redisVolatile);
}

export function createNewPersistentClient(): RedisClientType {
    if (config.redisPersistent === null)
        throw new Error('A persistent Redis server is required for using the worker or auth functionality!');

    if (config.env === 'test' && testClient)
        return testClient;

    return createClientWithSocketOptions(config.redisPersistent);
}

// For test purposes
export function setRedisClient(client: RedisClientType | null): void {
    if (config.env === 'test')
        testClient = client;
}


function createClientWithSocketOptions(redisSocketOptions: RedisSocketOptions): RedisClientType {
    return createClient({
        socket: {
            reconnectStrategy: retries => Math.min(retries * 100, 3000),
            ...redisSocketOptions
        }
    });
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

