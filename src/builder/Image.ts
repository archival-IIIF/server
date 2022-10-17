import {AuthService, Image, AccessTier, ImageProfile} from '@archival-iiif/presentation-builder/v2';

import config from '../lib/Config.js';
import {Item} from '../lib/ItemInterfaces.js';
import {sizeOf} from '../lib/Promisified.js';
import {DerivativeType} from '../lib/Derivative.js';
import {getFullDerivativePath} from '../lib/Item.js';
import {AccessState, getAuthTexts, getDefaultAccess} from '../lib/Security.js';

import {authUri, imageUri} from './UriHelper.js';

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

export async function getLogoInfo(profile: ImageProfile): Promise<Image> {
    const [width, height] = config.logoDimensions as [number, number];

    const imageInfo = new Image(imageUri('logo'), width, height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setImageProfile(profile);

    return imageInfo;
}

export async function getAudioInfo(profile: ImageProfile): Promise<Image> {
    const [width, height] = config.audioDimensions as [number, number];

    const imageInfo = new Image(imageUri('audio'), width, height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setImageProfile(profile);

    return imageInfo;
}
