const Base = require('./Base');

class Manifest extends Base {
    constructor(id, label, sequence, mediaSequence) {
        super(id, 'sc:Manifest', label);
        if (sequence)
            this.setSequence(sequence);
        if (mediaSequence)
            this.setMediaSequence(mediaSequence);
    }

    setSequence(sequence) {
        this.sequences = [sequence];
    }

    setMediaSequence(mediaSequence) {
        this.mediaSequences = [mediaSequence];
    }
}

module.exports = Manifest;
