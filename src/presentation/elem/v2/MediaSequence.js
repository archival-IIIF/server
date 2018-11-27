const Base = require('./Base');

class MediaSequence extends Base {
    constructor(id, element) {
        super(id, 'ixif:MediaSequence', null);
        if (element) this.addElement(element);
    }

    addElement(element) {
        if (!this.elements)
            this.elements = [];

        this.elements.push(element);
    }
}

module.exports = MediaSequence;
