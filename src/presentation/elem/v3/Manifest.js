const Base = require('./Base');

class Manifest extends Base {
    constructor(id, label) {
        super(id, 'Manifest', label);
    }
}

module.exports = Manifest;
