const Base = require('./Base');

class Canvas extends Base {
    constructor(id, image) {
        super(id, 'sc:Canvas', null);
        this.height = image.resource.height;
        this.width = image.resource.width;
        this.images = [image];
    }
}

module.exports = Canvas;
