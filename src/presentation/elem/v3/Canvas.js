const Base = require('./Base');

class Canvas extends Base {
    constructor(id, width, height, duration) {
        super(id, 'Canvas', null);
        if (width) this.width = width;
        if (height) this.height = height;
        if (duration) this.duration = duration;
    }
}

module.exports = Canvas;
