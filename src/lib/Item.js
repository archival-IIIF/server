const path = require('path');
const {db} = require('../lib/DB');
const config = require('../lib/Config');
const HttpError = require('../lib/HttpError');

async function getItem(id) {
    try {
        return await db.one('SELECT * FROM items WHERE id = $1;', id);
    }
    catch (e) {
        throw new HttpError(404, `No file found with id ${id}`);
    }
}

function getFullPath(item, type = null) {
    const relativePath = getRelativePath(item, type);
    return path.join(config.dataPath, relativePath);
}

function getRelativePath(item, type = null) {
    if (type === 'access')
        return item.access_resolver;

    if (type === 'original')
        return item.original_resolver;

    return item.access_resolver ? item.access_resolver : item.original_resolver;
}

module.exports = {getItem, getFullPath, getRelativePath};
