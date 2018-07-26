const redis = require("redis");
const config = require("./Config");

const client = createNewClient();

function createNewClient() {
    return redis.createClient(config.redis);
}

module.exports = {client, createNewClient};
