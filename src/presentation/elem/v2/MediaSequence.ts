import Base from './Base';
import Resource from './Resource';

export default class MediaSequence extends Base {
    elements?: Resource[];

    constructor(id: string, element: Resource) {
        super(id, 'ixif:MediaSequence');
        if (element) this.addElement(element);
    }

    addElement(element: Resource): void {
        if (!this.elements)
            this.elements = [];

        this.elements.push(element);
    }
}
