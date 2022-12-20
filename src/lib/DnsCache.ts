import http from 'http';
import https from 'https';
import CacheableLookup from 'cacheable-lookup';

import logger from './Logger.js';

const cacheable = new CacheableLookup();

cacheable.install(http.globalAgent);
cacheable.install(https.globalAgent);

logger.info('Enabled the DNS cache');
