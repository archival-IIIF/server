import Base from './Base';
import Canvas from './Canvas';

export default class Sequence extends Base {
    canvases?: Canvas[];

    constructor(id: string, canvas: Canvas | null) {
        super(id, 'sc:Sequence');
        if (canvas)
            this.addCanvas(canvas);
    }

    addCanvas(canvas: Canvas): void {
        if (!this.canvases)
            this.canvases = [];

        this.canvases.push(canvas);
    }
}
