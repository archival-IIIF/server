import Base from './Base';

export default class Resource extends Base {
    format: string;
    width?: number;
    height?: number;

    constructor(id: string, width: number | null, height: number | null, format: string, type?: string) {
        super(id, type);
        this.format = format;
        if (width) this.width = width;
        if (height) this.height = height;
    }
}

