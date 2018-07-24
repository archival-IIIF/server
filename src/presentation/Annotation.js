const Base = require('./Base');

class Annotation extends Base {
    constructor(id, resource, motivation = 'sc:painting') {
        super(id, 'oa:Annotation', null);
        this.motivation = motivation;
        this.resource = resource;
    }

    setCanvas(canvas) {
        this.on = canvas['@id'];
    }
}

module.exports = Annotation;
