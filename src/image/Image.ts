import {ImageProfile} from './profiles';

import Base from '../presentation/elem/v2/Base';
import {AccessTier} from '../lib/Security';

export default class Image extends Base {
    profile: string | [string, ImageProfile] = 'http://iiif.io/api/image/2/level2.json';

    protocol: string;
    width: number;
    height: number;
    sizes: [];

    maxWidth?: number;
    maxHeight?: number;

    constructor(id: string, width: number, height: number) {
        super(id);
        this.protocol = 'http://iiif.io/api/image';
        this.width = width;
        this.height = height;
        this.sizes = [];
    }

    setProfile(profile: ImageProfile): void {
        this.profile = ['http://iiif.io/api/image/2/level2.json', profile];
    }

    setTier(tier: AccessTier, seperator: string): void {
        this['@id'] += `${seperator}${tier.name}`;

        const maxSize = Image.computeMaxSize(tier, this.width, this.height);
        if (maxSize) {
            this.maxWidth = maxSize.maxWidth;
            this.maxHeight = maxSize.maxHeight;
        }
    }

    static computeMaxSize(tier: AccessTier, width: number, height: number)
        : null | { maxWidth: number; maxHeight: number; } {
        if ((width <= tier.maxSize) && (height <= tier.maxSize))
            return null;

        return {
            maxWidth: (width > height) ? tier.maxSize : Math.round(width * (tier.maxSize / height)),
            maxHeight: (height > width) ? tier.maxSize : Math.round(height * (tier.maxSize / width))
        }
    }
}
