import {AuthService, Image, AccessTier, ImageProfile} from '@archival-iiif/presentation-builder/v2';

import config from '../lib/Config.js';
import {Item} from '../lib/ItemInterfaces.js';
import {sizeOf} from '../lib/Promisified.js';
import {DerivativeType} from '../lib/Derivative.js';
import {getFullDerivativePath, getFullPathFor} from '../lib/Item.js';
import {AccessState, getAuthTexts, getDefaultAccess} from '../lib/Security.js';

import {authUri, imageUri} from './UriHelper.js';

const dimensions: { [type: string]: [number, number] } = {};

export async function getInfo(item: Item, derivative: DerivativeType | null,
                              profile: ImageProfile, tier?: AccessTier): Promise<Image> {
    let width = item.width as number;
    let height = item.height as number;

    if (derivative && (item.type === 'pdf' || derivative.type === 'video-mosaic')) {
        const size = await sizeOf(getFullDerivativePath(item, derivative));
        width = size?.width as number;
        height = size?.height as number;
    }

    const access = await getDefaultAccess(item);
    if (access.tier)
        profile = {...profile, maxWidth: access.tier.maxSize};

    const imageInfo = new Image(imageUri(item.id), width, height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setImageProfile(profile);

    if (access.state !== AccessState.OPEN) {
        const authTexts = await getAuthTexts(item);
        for (const type of ['login', 'external'] as ('login' | 'external')[]) {
            const service = AuthService.getAuthenticationService(authUri, authTexts, type);
            if (service !== null)
                imageInfo.setService(service);
        }
    }

    if (derivative?.imageTier)
        imageInfo.setTier(derivative.imageTier, config.imageTierSeparator);
    else if (typeof tier === 'object')
        imageInfo.setTier(tier, config.imageTierSeparator);

    return imageInfo;
}

export async function getStaticImageInfo(type: 'logo' | 'audio', profile?: ImageProfile): Promise<Image> {
    let width: number | undefined, height: number | undefined;
    if (type in dimensions)
        [width, height] = dimensions[type];
    else {
        const relativePath = type === 'logo' ? config.logoRelativePath : config.audioRelativePath;
        const size = await sizeOf(getFullPathFor(relativePath!));
        width = size?.width as number;
        height = size?.height as number;
        dimensions[type] = [width, height];
    }

    const imageInfo = new Image(imageUri(type), width, height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    profile && imageInfo.setImageProfile(profile);

    return imageInfo;
}
