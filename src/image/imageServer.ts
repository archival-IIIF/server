import {sharpProfile, lorisProfile} from './profiles';

import config from '../lib/Config';
import {ImageItem} from '../lib/ItemInterfaces';
import {getRelativePath} from '../lib/Item';
import {getEnabledAuthServices, requiresAuthentication, getAuthTexts} from '../lib/Security';

import AuthService from '../presentation/elem/v2/AuthService';
import Image, {ImageProfile, AccessTier} from '../presentation/elem/v2/Image';

export interface ImageOptions {
    region: string,
    size: string,
    rotation: string,
    quality: string,
    format: string
}

export interface ImageResult {
    image: Buffer | null,
    status: number,
    contentType: string | null,
    contentLength: number | null
}

export async function getInfo(item: ImageItem, tier?: AccessTier, id?: string): Promise<Image> {
    if (!id)
        id = item.id;

    const imageInfo = new Image(`${config.baseUrl}/iiif/image/${id}`, item.width, item.height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setProfile(getProfile());

    if (await requiresAuthentication(item)) {
        const authTexts = await getAuthTexts(item);
        getEnabledAuthServices().forEach(type => {
            const service = AuthService.getAuthenticationService(
                `${config.baseUrl}/iiif/auth`, authTexts, type);
            if (service !== null)
                imageInfo.setService(service);
        });
    }

    if (typeof tier === 'object')
        imageInfo.setTier(tier, config.imageTierSeparator);

    return imageInfo;
}

export async function getLogoInfo(): Promise<Image> {
    const [width, height] = config.logoDimensions as [number, number];

    const imageInfo = new Image(`${config.baseUrl}/iiif/image/logo`, width, height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setProfile(getProfile());

    return imageInfo;
}

export async function getImage(item: ImageItem, imageOptions: ImageOptions, tier?: AccessTier): Promise<ImageResult> {
    const maxSize = tier ? Image.computeMaxSize(tier, item.width, item.height) : undefined;
    const serveImage = await import(config.imageServerUrl ? './external' : './internal');

    return serveImage.default({
        rootPath: config.dataRootPath,
        relativePath: getRelativePath(item),
        size: {width: item.width, height: item.height},
        maxSize
    }, imageOptions);
}

export async function getLogo(imageOptions: ImageOptions): Promise<ImageResult> {
    const [width, height] = config.logoDimensions as [number, number];
    const serveImage = await import(config.imageServerUrl ? './external' : './internal');

    return serveImage.default({
        rootPath: config.dataRootPath,
        relativePath: config.logoRelativePath as string,
        size: {width, height}
    }, imageOptions);
}

export function getProfile(): ImageProfile {
    if (!config.imageServerUrl || config.imageServerName === 'sharp')
        return sharpProfile;

    return lorisProfile;
}
