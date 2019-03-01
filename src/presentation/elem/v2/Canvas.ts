import Base from './Base';
import Annotation from './Annotation';
import AnnotationList from './AnnotationList';

export default class Canvas extends Base {
    width: number;
    height: number;
    images: Annotation[];

    otherContent?: AnnotationList[];

    constructor(id: string, image: Annotation, annotationList?: AnnotationList) {
        super(id, 'sc:Canvas');
        this.width = image.resource.width as number;
        this.height = image.resource.height as number;
        this.images = [image];
        if (annotationList) this.otherContent = [annotationList];
    }
}
