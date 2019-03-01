import Base from './Base';

export default class Canvas extends Base {
    width?: number;
    height?: number;
    duration?: number;

    constructor(id: string, width?: number | null, height?: number | null, duration?: number | null) {
        super(id, 'Canvas');
        if (width) this.width = width;
        if (height) this.height = height;
        if (duration) this.duration = duration;
    }
}
