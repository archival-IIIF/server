const {promisify} = require('util');
const {client} = require('../lib/Redis');
const config = require('../lib/Config');

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const saddAsync = promisify(client.sadd).bind(client);
const smembersAsync = promisify(client.smembers).bind(client);
const delAsync = promisify(client.del).bind(client);

async function cache(type, group, id, content, secondsToExpire = 86400) {
    if (config.cacheDisabled)
        return await content();

    const key = `${type}:${group}:${id}`;
    const cachedValue = await getAsync(key);
    if (cachedValue)
        return JSON.parse(cachedValue);

    const toBeCached = await content();
    if (toBeCached) {
        await setAsync(key, JSON.stringify(toBeCached), 'EX', secondsToExpire);

        const groupKey = `${type}:${group}`;
        await saddAsync(groupKey, key);

        return toBeCached;
    }

    return null;
}

async function evictCache(type, group) {
    if (config.cacheDisabled)
        return;

    const groupKey = `${type}:${group}`;
    const keysToRemove = await smembersAsync(groupKey);
    await delAsync(groupKey, ...keysToRemove);
}

module.exports = {cache, evictCache};
