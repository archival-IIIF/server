const path = require('path');
const pool = require('../lib/DB');
const config = require('../lib/Config');
const HttpError = require('../lib/HttpError');

async function getFullPath(id, type = null) {
    const relativePath = await getRelativePath(id, type);
    return path.join(config.dataPath, relativePath);
}

async function getRelativePath(id, type = null) {
    const sql = `
            SELECT access_resolver, original_resolver
            FROM manifest 
            WHERE id = $1;`;

    const data = await pool.query(sql, [id]);
    if (data.rows.length === 0)
        throw new HttpError(404, `No manifest found with id ${id}`);

    if (type === 'access')
        return data.rows[0].access_resolver;

    if (type === 'original')
        return data.rows[0].original_resolver;

    return data.rows[0].access_resolver ? data.rows[0].access_resolver : data.rows[0].original_resolver;
}

module.exports = {getFullPath, getRelativePath};
