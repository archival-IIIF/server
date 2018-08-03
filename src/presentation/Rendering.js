const Base = require('./Base');

class Rendering extends Base {
    constructor(id, format) {
        super(id, null, null);
        this.format = format;
    }
}

module.exports = Rendering;
