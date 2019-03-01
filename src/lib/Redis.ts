import config from './Config';
import {createHandyClient, IHandyRedis} from 'handy-redis';

export const client = (config.redis !== null) ? createNewClient() : null;

export function createNewClient(): IHandyRedis {
    if (config.redis === null)
        throw new Error('Redis is required for using either the cache or the auth functionality!');

    return createHandyClient(config.redis);
}
