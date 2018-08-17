const Base = require('./Base');

class Resource extends Base {
    constructor(id, width, height, format, type) {
        super(id, type, null);
        this.format = format;
        if (width) this.width = width;
        if (height) this.height = height;
    }
}

module.exports = Resource;
