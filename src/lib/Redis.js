const redis = require('redis');
const config = require('./Config');

const client = createNewClient();

function createNewClient() {
    if (config.redis !== null)
        return redis.createClient(config.redis);

    if (!config.cacheDisabled || !config.loginDisabled || config.internalIpAddresses.length > 0)
        throw new Error('Redis is required for using either the cache or the auth functionality!');

    return null;
}

module.exports = {client, createNewClient};
