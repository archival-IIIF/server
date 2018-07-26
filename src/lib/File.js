const path = require('path');
const db = require('../lib/DB');
const config = require('../lib/Config');
const HttpError = require('../lib/HttpError');

async function getFullPath(id, type = null) {
    const relativePath = await getRelativePath(id, type);
    return path.join(config.dataPath, relativePath);
}

async function getRelativePath(id, type = null) {
    try {
        const sql = `
            SELECT access_resolver, original_resolver
            FROM manifest 
            WHERE id = $1;`;

        const file = await db.one(sql, id);

        if (type === 'access')
            return file.access_resolver;

        if (type === 'original')
            return file.original_resolver;

        return file.access_resolver ? file.access_resolver : file.original_resolver;
    }
    catch (e) {
        throw new HttpError(404, `No file found with id ${id}`);
    }
}

module.exports = {getFullPath, getRelativePath};
