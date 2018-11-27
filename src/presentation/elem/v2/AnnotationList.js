const Base = require('./Base');

class AnnotationList extends Base {
    constructor(id, label) {
        super(id, 'sc:AnnotationList', label);
    }
}

module.exports = AnnotationList;
