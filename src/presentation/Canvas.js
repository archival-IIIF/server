const Base = require('./Base');

class Canvas extends Base {
    constructor(id, image) {
        super(id, 'sc:Canvas', null);
        this.width = image.resource.width;
        this.height = image.resource.height;
        this.images = [image];
    }
}

module.exports = Canvas;
