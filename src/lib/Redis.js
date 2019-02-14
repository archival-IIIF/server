const config = require('./Config');
const {createHandyClient} = require('handy-redis');

const client = (config.redis !== null) ? createNewClient() : null;

function createNewClient() {
    if (config.redis === null)
        throw new Error('Redis is required for using either the cache or the auth functionality!');

    return createHandyClient(config.redis);
}

module.exports = {client, createNewClient};
