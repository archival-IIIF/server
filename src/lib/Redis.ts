import config from './Config';
import {createHandyClient, IHandyRedis} from 'handy-redis';

let testClient: IHandyRedis | null = null;
const client = (config.redis !== null && config.env !== 'test') ? createNewClient() : null;

export function getClient(): IHandyRedis | null {
    if (config.env === 'test' && testClient)
        return testClient;

    return client;
}

export function createNewClient(): IHandyRedis {
    if (config.redis === null)
        throw new Error('Redis is required for using either the cache or the auth functionality!');

    if (config.env === 'test' && testClient)
        return testClient;

    return createHandyClient(config.redis);
}

// For test purposes
export function setRedisClient(client: IHandyRedis): void {
    if (config.env === 'test')
        testClient = client;
}
