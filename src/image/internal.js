const {getFullPath} = require('../lib/Item');

const ImageProcessing = require('./ImageProcessing');
const RegionRequest = require('./RegionRequest');
const SizeRequest = require('./SizeRequest');
const RotateRequest = require('./RotateRequest');
const QualityRequest = require('./QualityRequest');
const FormatRequest = require('./FormatRequest');
const {RequestError, NotImplementedError} = require('./errors');

async function serveImage(item, {region, size, rotation, quality, format}) {
    const result = {
        image: null,
        status: 200,
        contentType: null,
        contentLength: null
    };

    try {
        const processingInfo = {uri: getFullPath(item), size: {width: item.width, height: item.height}};
        const imageProcessing = new ImageProcessing(processingInfo, [
            new RegionRequest(region),
            new SizeRequest(size),
            new RotateRequest(rotation),
            new QualityRequest(quality),
            new FormatRequest(format)
        ]);

        const processedImage = await imageProcessing.process();
        result.image = processedImage.data;
        result.contentLength = processedImage.size;
        result.contentType = getContentType(format);
    }
    catch (err) {
        if (err instanceof RequestError)
            result.status = 400;
        else if (err instanceof NotImplementedError)
            result.status = 501;
        else
            throw err;
    }

    return result;
}

function getContentType(extension) {
    switch (extension) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'tif':
        case 'tiff':
            return 'image/tiff';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        default:
            return null;
    }
}

module.exports = serveImage;
