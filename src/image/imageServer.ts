import * as got from 'got';

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

export async function getImage(item: ImageItem, imageOptions: ImageOptions): Promise<ImageResult> {
    return serveImage(getRelativePath(item), imageOptions);
}

export async function getLogo(imageOptions: ImageOptions): Promise<ImageResult> {
    return serveImage(config.logoRelativePath as string, imageOptions);
}

export function getProfile(): ImageProfile {
    if (!config.imageServerUrl || config.imageServerName === 'sharp')
        return sharpProfile;

    return lorisProfile;
}

async function serveImage(relativePath: string,
                          {region, size, rotation, quality, format}: ImageOptions): Promise<ImageResult> {
    size = (size === 'max') ? 'full' : size;

    const encodedPath = encodeURIComponent(relativePath);
    const url = `${config.imageServerUrl}/${encodedPath}/${region}/${size}/${rotation}/${quality}.${format}`;
    const response = await got.default(url, {responseType: 'buffer', throwHttpErrors: false});

    return {
        image: (response.statusCode === 200) ? response.body : null,
        status: response.statusCode,
        contentType: (response.statusCode === 200) ? response.headers['content-type'] as string : null,
        contentLength: (response.statusCode === 200) ? parseInt(response.headers['content-length'] as string) : null
    };
}
