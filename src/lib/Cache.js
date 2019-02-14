const {client} = require('../lib/Redis');
const config = require('../lib/Config');
const logger = require('./Logger');

async function cache(type, group, id, content, secondsToExpire = 86400) {
    if (config.cacheDisabled)
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

        return toBeCached;
    }

    return null;
}

async function evictCache(type, group) {
    if (config.cacheDisabled)
        return;

    logger.debug(`Evicting cache for type ${type} and group ${group}`);

    const groupKey = `${type}:${group}`;
    const keysToRemove = await client.smembers(groupKey);
    await client.del(groupKey, ...keysToRemove);
}

module.exports = {cache, evictCache};
