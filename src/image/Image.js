const Base = require('../presentation/Base');

class Image extends Base {
    constructor(id, width, height) {
        super(id, null, null);
        this.protocol = 'http://iiif.io/api/image';
        this.width = width;
        this.height = height;
        this.sizes = [];
    }

    setProfile(profile) {
        this.profile = profile;
    }

    setTier(tier, seperator) {
        this['@id'] += `${seperator}${tier.name}`;

        const maxSize = Image.computeMaxSize(tier, this.width, this.height);
        if (maxSize) {
            this.maxWidth = maxSize.maxWidth;
            this.maxHeight = maxSize.maxHeight;
        }
    }

    static computeMaxSize(tier, width, height) {
        if ((width <= tier.maxSize) && (height <= tier.maxSize))
            return null;

        return {
            maxWidth: (width > height) ? tier.maxSize : Math.round(width * (tier.maxSize / height)),
            maxHeight: (height > width) ? tier.maxSize : Math.round(height * (tier.maxSize / width))
        }
    }
}

module.exports = Image;
