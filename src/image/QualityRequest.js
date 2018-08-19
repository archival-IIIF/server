const {RequestError} = require('./errors');

class QualityRequest {
    constructor(request) {
        this.request = request;
        this.setQuality = false;
    }

    parseImageRequest(processingInfo) {
        switch (this.request) {
            case 'color':
            case 'default':
                this.setQuality = false;
                break;
            case 'gray':
            case 'bitonal':
                this.setQuality = true;
                break;
            default:
                throw new RequestError(`Incorrect quality request: ${this.request}`);
        }
    }

    requiresImageProcessing() {
        return this.setQuality;
    }

    executeImageProcessing(image) {
        if (this.request === 'gray')
            image.gamma().grayscale();
        else if (this.request === 'bitonal')
            image.threshold();
    }
}

module.exports = QualityRequest;
