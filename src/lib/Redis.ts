import config from './Config';
import {ClientOpts} from 'redis';
import {createNodeRedisClient, WrappedNodeRedisClient} from 'handy-redis';

let testClient: WrappedNodeRedisClient | null = null;
const volatileClient = (config.redisVolatile !== null && config.env !== 'test') ? createNewVolatileClient() : null;
const persistentClient = (config.redisPersistent !== null && config.env !== 'test') ? createNewPersistentClient() : null;

export function getVolatileClient(): WrappedNodeRedisClient | null {
    if (config.env === 'test' && testClient)
        return testClient;

    return volatileClient;
}

export function getPersistentClient(): WrappedNodeRedisClient | null {
    if (config.env === 'test' && testClient)
        return testClient;

    return persistentClient;
}

export function createNewVolatileClient(): WrappedNodeRedisClient {
    if (config.redisVolatile === null)
        throw new Error('A volatile Redis server is required for using the cache functionality!');

    if (config.env === 'test' && testClient)
        return testClient;

    return createClient(config.redisVolatile);
}

export function createNewPersistentClient(): WrappedNodeRedisClient {
    if (config.redisPersistent === null)
        throw new Error('A persistent Redis server is required for using the worker or auth functionality!');

    if (config.env === 'test' && testClient)
        return testClient;

    return createClient(config.redisPersistent);
}

// For test purposes
export function setRedisClient(client: WrappedNodeRedisClient | null): void {
    if (config.env === 'test')
        testClient = client;
}

function createClient(redisConfig: ClientOpts): WrappedNodeRedisClient {
    return createNodeRedisClient({
        retry_strategy: options => Math.min(options.attempt * 100, 3000),
        ...redisConfig
    });
}
