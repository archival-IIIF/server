const Base = require('./Base');

class Canvas extends Base {
    constructor(id, image, annotationList) {
        super(id, 'sc:Canvas', null);
        this.width = image.resource.width;
        this.height = image.resource.height;
        this.images = [image];
        if (annotationList) this.otherContent = [annotationList];
    }
}

module.exports = Canvas;
