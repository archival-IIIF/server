const sharp = require('sharp');
const {getItem, getFullPath} = require('../lib/Item');

async function serveImage(id, {region, size, rotation, quality, format}) {
    const result = {
        image: null,
        status: 200,
        contentType: 'image/jpeg',
        contentLength: null
    };

    const item = await getItem(id);
    const fullPath = getFullPath(item);
    const buildImage = sharp(fullPath);

    if (size.includes(',')) {
        let sizeArray = size.split(',');
        let width = sizeArray[0];
        let height = sizeArray[1];
        if (isNormalInteger(width) && isNormalInteger(height)) {
            buildImage.resize(parseInt(width), parseInt(height));
        }
    }

    region = getRegion(region);
    if (region)
        buildImage.extract(region);

    if (isNormalInteger(rotation)) {
        rotation = parseInt(rotation);
        if (rotation === 0 || rotation === 90 || rotation === 180 || rotation === 270 || rotation === 360)
            buildImage.rotate(rotation);
    }

    const image = await buildImage.toBuffer({resolveWithObject: true});

    result.contentLength = image.info.size;
    result.image = image.data;

    return result;
}

function getRegion(region) {
    const output = {};
    if (region.includes(',')) {
        const regionArray = region.split(',');

        if (regionArray.length !== 4) {
            return false;
        }

        if (!isNormalInteger(regionArray[0])) {
            return false;
        }
        output.left = parseInt(regionArray[0]);

        if (!isNormalInteger(regionArray[1])) {
            return false;
        }
        output.top = parseInt(regionArray[1]);

        if (!isNormalInteger(regionArray[2])) {
            return false;
        }
        output.width = parseInt(regionArray[2]);

        if (!isNormalInteger(regionArray[3])) {
            return false;
        }
        output.height = parseInt(regionArray[3]);

        return output;
    }

    return false;
}

function isNormalInteger(str) {
    const n = Math.floor(Number(str));
    return n !== Infinity && String(n) === str && n >= 0;
}

module.exports = serveImage;
