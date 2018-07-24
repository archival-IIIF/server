const request = require('request-promise-native');
const config = require('../lib/Config');
const file = require('../lib/File');

async function getInfo(id) {
    const path = await file.getRelativePath(id);
    const url = `${config.imageServerUrl}/${path}/info.json`;
    const response = await request({uri: url, json: true, resolveWithFullResponse: true, simple: false});

    const result = {
        info: null,
        status: response.statusCode
    };

    if (response.statusCode === 200) {
        response.body['@id'] = `${config.baseUrl}/iiif/image/${id}`;
        result.info = response.body;
    }

    return result;
}

async function getImage(id, region, size, rotation, quality, format) {
    const path = await file.getRelativePath(id);
    const url = `${config.imageServerUrl}/${path}/${region}/${size}/${rotation}/${quality}.${format}`;
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