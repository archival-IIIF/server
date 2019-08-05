import {join} from 'path';

import SizeRequest from './SizeRequest';
import {ImageProcessingInfo} from './ImageProcessing';
import {sharpProfile, lorisProfile} from './profiles';

import logger from '../lib/Logger';
import config from '../lib/Config';
import {ImageItem} from '../lib/ItemInterfaces';
import {getFullPath, getRelativePath} from '../lib/Item';
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
    const processingInfo: ImageProcessingInfo = {
        fullPath: getFullPath(item),
        relativePath: getRelativePath(item),
        size: {width: item.width, height: item.height}
    };

    if (typeof tier === 'object') {
        logger.debug(`Validate the size requested with the maximum size of tier ${tier}`);

        const maxSize = Image.computeMaxSize(tier, item.width, item.height);
        const sizeRequest = new SizeRequest(imageOptions.size);
        sizeRequest.parseImageRequest(processingInfo);

        if (maxSize &&
            ((processingInfo.size.width > maxSize.maxWidth) || (processingInfo.size.height > maxSize.maxHeight)))
            return {
                image: null,
                status: 401,
                contentType: null,
                contentLength: null
            };
    }

    const serveImage = await import(config.imageServerUrl ? './external' : './internal');
    return serveImage.default(processingInfo, imageOptions);
}

export async function getLogo(imageOptions: ImageOptions): Promise<ImageResult> {
    const [width, height] = config.logoDimensions as [number, number];
    const processingInfo: ImageProcessingInfo = {
        fullPath: join(config.dataRootPath, config.logoRelativePath as string),
        relativePath: config.logoRelativePath as string,
        size: {width, height}
    };

    const serveImage = await import(config.imageServerUrl ? './external' : './internal');
    return serveImage.default(processingInfo, imageOptions);
}

export function getProfile(): ImageProfile {
    return !config.imageServerUrl ? sharpProfile : lorisProfile;
}
