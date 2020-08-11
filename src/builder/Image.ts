import {promisify} from 'util';
import {imageSize} from 'image-size';

import config from '../lib/Config';
import {Item} from '../lib/ItemInterfaces';
import {DerivativeType} from '../lib/Derivative';
import {getFullDerivativePath} from '../lib/Item';
import {getAuthTexts, getEnabledAuthServices, requiresAuthentication} from '../lib/Security';

import AuthService from './elem/v2/AuthService';
import Image, {AccessTier, ImageProfile} from './elem/v2/Image';

import {authUri, imageUri} from './UriHelper';

const sizeOf = promisify(imageSize);

export async function getInfo(item: Item, derivative: DerivativeType | null,
                              profile: ImageProfile, tier?: AccessTier): Promise<Image> {
    let width = item.width as number;
    let height = item.height as number;

    if (derivative && (item.type === 'pdf' || derivative.type === 'video-mosaic')) {
        const size = await sizeOf(getFullDerivativePath(item, derivative));
        width = size?.width as number;
        height = size?.height as number;
    }

    const imageInfo = new Image(imageUri(item.id), width, height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setProfile(profile);

    if (await requiresAuthentication(item)) {
        const authTexts = await getAuthTexts(item);
        getEnabledAuthServices().forEach(type => {
            const service = AuthService.getAuthenticationService(authUri, authTexts, type);
            if (service !== null)
                imageInfo.setService(service);
        });
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
    imageInfo.setProfile(profile);

    return imageInfo;
}

export async function getAudioInfo(profile: ImageProfile): Promise<Image> {
    const [width, height] = config.audioDimensions as [number, number];

    const imageInfo = new Image(imageUri('audio'), width, height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setProfile(profile);

    return imageInfo;
}
