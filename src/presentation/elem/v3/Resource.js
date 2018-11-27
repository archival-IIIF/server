const Base = require('./Base');

class Resource extends Base {
    constructor(id, type, format, width, height, duration) {
        super(id, type, null);
        if (format) this.format = format;
        if (width) this.width = width;
        if (height) this.height = height;
        if (duration) this.duration = duration;
    }
}

module.exports = Resource;
