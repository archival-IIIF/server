const pg = require('pg-promise')();
const config = require('./Config');

const db = pg(config.database);

module.exports = {pg, db};
