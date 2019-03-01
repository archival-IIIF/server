import Image, {ImageProfile} from './Image';
import SizeRequest from './SizeRequest';
import {ImageProcessingInfo} from './ImageProcessing';

import logger from '../lib/Logger';
import config from '../lib/Config';
import {ImageItem} from '../lib/ItemInterfaces';
import {enabledAuthServices, requiresAuthentication, getAuthTexts, AccessTier} from '../lib/Security';

import AuthService from '../presentation/elem/v2/AuthService';

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

export async function getInfo(item: ImageItem, tier: AccessTier | undefined, id: string): Promise<Image> {
    if (!id)
        id = item.id;

    const imageInfo = new Image(`${config.baseUrl}/iiif/image/${id}`, item.width, item.height);
    imageInfo.setContext('http://iiif.io/api/image/2/context.json');
    imageInfo.setProfile(getProfile());

    if (await requiresAuthentication(item)) {
        const authTexts = await getAuthTexts(item);
        enabledAuthServices.forEach(type => {
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

export async function getImage(item: ImageItem, tier: AccessTier | undefined,
                               imageOptions: ImageOptions): Promise<ImageResult> {
    if (typeof tier === 'object') {
        logger.debug(`Validate the size requested with the maximum size of tier ${tier}`);

        const maxSize = Image.computeMaxSize(tier, item.width, item.height);

        const sizeRequest = new SizeRequest(imageOptions.size);
        const processingInfo: ImageProcessingInfo = {size: {width: item.width, height: item.height}};
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
    return await serveImage.default(item, imageOptions);
}

export function getProfile(): ImageProfile {
    if (!config.imageServerUrl)
        return require('./profile/sharp');
    return require('./profile/loris');
}
