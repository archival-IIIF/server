import config from '../lib/Config';
import {ImageItem} from '../lib/ItemInterfaces';
import {getAuthTexts, getEnabledAuthServices, requiresAuthentication} from '../lib/Security';

import AuthService from './elem/v2/AuthService';
import Image, {AccessTier, ImageProfile} from './elem/v2/Image';

import {authUri, imageUri} from './UriHelper';

export async function getInfo(item: ImageItem, profile: ImageProfile, tier?: AccessTier): Promise<Image> {
    const imageInfo = new Image(imageUri(item.id), item.width, item.height);
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

    if (typeof tier === 'object')
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
