import logger from './Logger.js';
import {getVolatileClient} from './Redis.js';

export async function cache<T>(type: string, group: string, id: string, content: () => Promise<T>,
                               secondsToExpire = 86400): Promise<T> {
    const client = getVolatileClient();
    if (!client)
        return content();

    const key = `${type}:${group}:${id}`;
    const cachedValue = await client.get(key);
    if (cachedValue) {
        logger.debug(`Found content in cache for type ${type} in group ${group} with id ${id}`);
        return JSON.parse(cachedValue);
    }

    const toBeCached = await content();
    if (toBeCached) {
        logger.debug(`Caching content for type ${type} in group ${group} with id ${id}`);

        const groupKey = `${type}:${group}`;
        await client.multi()
            .set(key, JSON.stringify(toBeCached), {EX: secondsToExpire})
            .sAdd(groupKey, key)
            .exec();
    }

    return toBeCached;
}

export async function evictCache(type: string, group: string): Promise<void> {
    const client = getVolatileClient();
    if (!client)
        return;

    logger.debug(`Evicting cache for type ${type} and group ${group}`);

    const groupKey = `${type}:${group}`;
    const keysToRemove = await client.sMembers(groupKey);
    await client.del([groupKey].concat(keysToRemove));
}
