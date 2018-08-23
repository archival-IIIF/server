const request = require('request-promise-native');
const config = require('../lib/Config');
const {getRelativePath} = require('../lib/Item');

async function serveImage(item, {region, size, rotation, quality, format}) {
    const path = getRelativePath(item);
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

module.exports = serveImage;
