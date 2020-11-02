import config from './Config';
import {createNodeRedisClient, WrappedNodeRedisClient} from 'handy-redis';

let testClient: WrappedNodeRedisClient | null = null;
const client = (config.redis !== null && config.env !== 'test') ? createNewClient() : null;

export function getClient(): WrappedNodeRedisClient | null {
    if (config.env === 'test' && testClient)
        return testClient;

    return client;
}

export function createNewClient(): WrappedNodeRedisClient {
    if (config.redis === null)
        throw new Error('Redis is required for using either the cache or the auth functionality!');

    if (config.env === 'test' && testClient)
        return testClient;

    return createNodeRedisClient({
        retry_strategy: options => Math.min(options.attempt * 100, 3000),
        ...config.redis
    });
}

// For test purposes
export function setRedisClient(client: WrappedNodeRedisClient): void {
    if (config.env === 'test')
        testClient = client;
}
