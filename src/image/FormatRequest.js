const {NotImplementedError, RequestError} = require('./errors');

class FormatRequest {
    constructor(request) {
        this.request = request;
        this.formatOptions = null;
    }

    parseImageRequest(processingInfo) {
        switch (this.request) {
            case 'jpg':
            case 'png':
            case 'webp':
            case 'tif':
                this.formatOptions = FormatRequest.OUTPUT_FORMATS[this.request];
                break;
            case 'gif':
            case 'jp2':
            case 'pdf':
                throw new NotImplementedError(`Format ${this.request} not supported`);
            default:
                throw new RequestError(`Incorrect format request: ${this.request}`);
        }
    }

    requiresImageProcessing() {
        return (this.formatOptions !== undefined && this.formatOptions !== null);
    }

    executeImageProcessing(image) {
        if (this.requiresImageProcessing()) image.toFormat(this.formatOptions);
    }
}

FormatRequest.OUTPUT_FORMATS = {
    'jpg': {
        id: 'jpeg',
        quality: 80,
        progressive: false
    },
    'png': {
        id: 'png',
        compressionLevel: 6,
        progressive: false
    },
    'webp': {
        id: 'webp',
        quality: 80
    },
    'tif': {
        id: 'tiff',
        quality: 80
    }
};

module.exports = FormatRequest;
