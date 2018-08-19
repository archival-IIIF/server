const sharp = require('sharp');

class ImageProcessing {
    constructor(processingInfo, requests) {
        this.processingInfo = processingInfo;
        this.requests = requests;

        this.requests.forEach(request => request.parseImageRequest(this.processingInfo));
    }

    async process() {
        const image = sharp(this.processingInfo.uri);
        if (this.requests.filter(request => request.requiresImageProcessing()).length > 0)
            this.requests.forEach(request => request.executeImageProcessing(image));
        return await image.toBuffer({resolveWithObject: true});
    }
}

module.exports = ImageProcessing;
