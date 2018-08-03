const Base = require('./Base');

class MediaSequence extends Base {
    constructor(id, element) {
        super(id, 'ixif:MediaSequence', null);
        if (element) this.setElement(element);
    }

    setElement(element) {
        this.elements = [element];
    }
}

module.exports = MediaSequence;
