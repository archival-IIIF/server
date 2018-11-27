const Base = require('./Base');

class Sequence extends Base {
    constructor(id, canvas) {
        super(id, 'sc:Sequence', null);
        if (canvas)
            this.addCanvas(canvas);
    }

    addCanvas(canvas) {
        if (!this.canvases)
            this.canvases = [];

        this.canvases.push(canvas);
    }
}

module.exports = Sequence;
