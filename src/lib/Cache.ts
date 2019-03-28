import {getClient} from './Redis';
import logger from './Logger';
import config from './Config';

export async function cache<T>(type: string, group: string, id: string,
                               content: () => Promise<T>, secondsToExpire = 86400): Promise<T> {
    const client = getClient();
    if (!client || config.cacheDisabled)
        return await content();

    const key = `${type}:${group}:${id}`;
    const cachedValue = await client.get(key);
    if (cachedValue) {
        logger.debug(`Found content in cache for type ${type} in group ${group} with id ${id}`);
        return JSON.parse(cachedValue);
    }

    const toBeCached = await content();
    if (toBeCached) {
        logger.debug(`Caching content for type ${type} in group ${group} with id ${id}`);
        await client.set(key, JSON.stringify(toBeCached), ['EX', secondsToExpire]);

        const groupKey = `${type}:${group}`;
        await client.sadd(groupKey, key);
    }

    return toBeCached;
}

export async function evictCache(type: string, group: string): Promise<void> {
    const client = getClient();
    if (!client || config.cacheDisabled)
        return;

    logger.debug(`Evicting cache for type ${type} and group ${group}`);

    const groupKey = `${type}:${group}`;
    const keysToRemove = await client.smembers(groupKey);
    await client.del(groupKey, ...keysToRemove);
}
