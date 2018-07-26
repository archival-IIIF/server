const pg = require('pg-promise')();
const config = require('./Config');

module.exports = pg(config.database);
