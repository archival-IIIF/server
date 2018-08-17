const Base = require('./Base');

class Rendering extends Base {
    constructor(id, label, format) {
        super(id, null, label);
        this.format = format;
    }
}

module.exports = Rendering;
