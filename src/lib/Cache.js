const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const config = require('../lib/Config');
const mkdirp = require('mkdirp-promise');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const existsAsync = file => new Promise(resolve => fs.access(file, fs.F_OK, e => resolve(!e)));

async function cache(type, id, content) {
    if (!config.cachePath)
        return await content();

    const cacheDirName = path.join(config.cachePath, type);
    const cachePath = path.join(cacheDirName, id);

    if (!await existsAsync(cacheDirName))
        await mkdirp(cacheDirName);

    if (await existsAsync(cachePath)) {
        const cached = await readFileAsync(cachePath, {encoding: 'utf8'});
        return JSON.parse(cached);
    }

    const toBeCached = await content();
    if (toBeCached) {
        await writeFileAsync(cachePath, JSON.stringify(toBeCached));
        return toBeCached;
    }

    return null;
}

module.exports = cache;
