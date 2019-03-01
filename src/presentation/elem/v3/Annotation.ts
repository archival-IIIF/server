import Base from './Base';
import Canvas from './Canvas';
import Resource from './Resource';

export default class Annotation extends Base {
    motivation: string;
    body: Resource;
    target?: string;

    constructor(id: string, resource: Resource, motivation = 'painting') {
        super(id, 'Annotation');
        this.motivation = motivation;
        this.body = resource;
    }

    setCanvas(canvas: Canvas): void {
        this.target = canvas.id;
    }
}
