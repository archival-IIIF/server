const { Pool } = require('pg');
const config = require('../helpers/Config');


module.exports = new Pool(config.database);


