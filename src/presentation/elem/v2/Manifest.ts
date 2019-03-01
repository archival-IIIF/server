import Base from './Base';
import Sequence from './Sequence';
import MediaSequence from './MediaSequence';

export default class Manifest extends Base {
    sequences?: Sequence[];
    mediaSequences?: MediaSequence[];

    constructor(id: string, label: string, sequence?: Sequence, mediaSequence?: MediaSequence) {
        super(id, 'sc:Manifest', label);
        if (sequence)
            this.setSequence(sequence);
        if (mediaSequence)
            this.setMediaSequence(mediaSequence);
    }

    setSequence(sequence: Sequence): void {
        this.sequences = [sequence];
    }

    setMediaSequence(mediaSequence: MediaSequence): void {
        this.mediaSequences = [mediaSequence];
    }
}
