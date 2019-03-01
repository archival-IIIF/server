import Base from './Base';
import Canvas from './Canvas';
import Resource from './Resource';

export default class Annotation extends Base {
    motivation: string;
    resource: Resource;
    on?: string;

    constructor(id: string, resource: Resource, motivation = 'sc:painting') {
        super(id, 'oa:Annotation');
        this.motivation = motivation;
        this.resource = resource;
    }

    setCanvas(canvas: Canvas): void {
        this.on = canvas['@id'];
    }
}
