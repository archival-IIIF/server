import Base from './Base';

export default class Rendering extends Base {
    format: string;

    constructor(id: string, label: string, format: string) {
        super(id, undefined, label);
        this.format = format;
    }
}
