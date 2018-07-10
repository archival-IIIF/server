const request = require('request-promise-native');
const config = require('../lib/Config');
const pool = require('../lib/DB');

async function getInfo(id) {
    const sql = `
        SELECT access_resolver, original_resolver
        FROM manifest 
        WHERE id = $1;`;

    const data = await pool.query(sql, [id]);
    if (data.rows.length === 0)
        throw 'Not found';

    let accessResolver = data.rows[0].access_resolver;
    if (!accessResolver)
        accessResolver = data.rows[0].original_resolver;

    const url = `${config.imageServerUrl}/${accessResolver}/info.json`;
    const response = await request({uri: url, json: true, resolveWithFullResponse: true, simple: false});

    const result = {
        info: null,
        status: response.statusCode
    };

    if (response.statusCode === 200) {
        response.body['@id'] = `${config.baseUrl}/iiif/image/${ctx.params.id}`;
        result.info = response.body;
    }

    return result;
}

async function getImage(id, region, size, rotation, quality, format) {
    const sql = `
            SELECT access_resolver, original_resolver
            FROM manifest 
            WHERE id = $1;`;

    const data = await pool.query(sql, [id]);
    if (data.rows.length === 0)
        throw 'Not found';

    let accessResolver = data.rows[0].access_resolver;
    if (!accessResolver)
        accessResolver = data.rows[0].original_resolver;

    const url = `${config.imageServerUrl}/${accessResolver}/${region}/${size}/${rotation}/${quality}.${format}`;
    const response = await request({uri: url, encoding: null, resolveWithFullResponse: true, simple: false});

    const result = {
        image: null,
        status: response.statusCode,
        contentType: null,
        contentLength: null
    };

    if (response.statusCode === 200) {
        result.image = response.body;
        result.contentType = response.headers['content-type'];
        result.contentLength = response.headers['content-length'];
    }

    return result;
}

module.exports = {getInfo, getImage};