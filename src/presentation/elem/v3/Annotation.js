const Base = require('./Base');

class Annotation extends Base {
    constructor(id, resource, motivation = 'painting') {
        super(id, 'Annotation', null);
        this.motivation = motivation;
        this.body = resource;
    }
}

module.exports = Annotation;
