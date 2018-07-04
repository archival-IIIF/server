const { Pool } = require('pg');
const config = require('./Config');

module.exports = new Pool(config.database);
