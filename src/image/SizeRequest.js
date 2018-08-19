const {RequestError} = require('./errors');

class SizeRequest {
    constructor(request) {
        this.request = request;
        this.newSize = {width: null, height: null};
        this.bestFit = false;
        this.isMax = false;
    }

    parseImageRequest(processingInfo) {
        if (this.request === 'full' || this.request === 'max')
            this.isMax = true;
        else {
            let result;
            if ((result = SizeRequest.SIZE_TO_WIDTH.exec(this.request)) !== null) {
                [, this.newSize.width] = result.map(i => parseInt(i));
                this.isMax = (this.newSize.width === processingInfo.size.width);
            }
            else if ((result = SizeRequest.SIZE_TO_HEIGHT.exec(this.request)) !== null) {
                [, this.newSize.height] = result.map(i => parseInt(i));
                this.isMax = (this.newSize.height === processingInfo.size.height);
            }
            else if ((result = SizeRequest.SIZE_TO_PERCENTAGE.exec(this.request)) !== null) {
                [, this.newSize.width] = result.map(i => Math.round((processingInfo.size.width / 100) * parseFloat(i)));
                this.isMax = (this.newSize.width === processingInfo.size.width);
            }
            else if ((result = SizeRequest.SIZE_TO_WIDTH_HEIGHT.exec(this.request)) !== null) {
                [, this.newSize.width, this.newSize.height] = result.map(i => parseInt(i));
                this.isMax = (this.newSize.width === processingInfo.size.width)
                    && (this.newSize.height === processingInfo.size.height);
            }
            else if ((result = SizeRequest.SIZE_TO_BEST_FIT.exec(this.request)) !== null) {
                [, this.newSize.width, this.newSize.height] = result.map(i => parseInt(i));
                this.isMax = (this.newSize.width === processingInfo.size.width)
                    && (this.newSize.height === processingInfo.size.height);
                this.bestFit = true;
            }
            else
                throw new RequestError(`Incorrect region request: ${this.request}`);

            if ((this.newSize.width === 0) || (this.newSize.height === 0))
                throw new RequestError('Size width and/or height should not be zero');
        }
    }

    requiresImageProcessing() {
        return !this.isMax;
    }

    executeImageProcessing(image) {
        if (this.requiresImageProcessing()) {
            image.resize(this.newSize.width, this.newSize.height);
            if (this.bestFit) image.max();
        }
    }
}

SizeRequest.SIZE_TO_WIDTH = /^([0-9]+),$/;
SizeRequest.SIZE_TO_HEIGHT = /^,([0-9]+)$/;
SizeRequest.SIZE_TO_PERCENTAGE = /^pct:([0-9]+.?[0-9]*)$/;
SizeRequest.SIZE_TO_WIDTH_HEIGHT = /^([0-9]+),([0-9]+)$/;
SizeRequest.SIZE_TO_BEST_FIT = /^!([0-9]+),([0-9]+)$/;

module.exports = SizeRequest;
