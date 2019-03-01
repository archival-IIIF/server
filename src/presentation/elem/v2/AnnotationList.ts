import Base from './Base';

export default class AnnotationList extends Base {
    constructor(id: string, label: string) {
        super(id, 'sc:AnnotationList', label);
    }
}
