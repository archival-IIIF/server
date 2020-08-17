import * as got from 'got';

import {sharpProfile, lorisProfile} from './profiles';

import config from '../lib/Config';
import {ImageItem} from '../lib/ItemInterfaces';
import {getRelativePath} from '../lib/Item';

import {ImageProfile} from '../builder/elem/v2/Image';

export interface Size {
    width: number;
    height: number;
}

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

export async function getImage(item: ImageItem, max: number | null,
                               imageOptions: ImageOptions): Promise<ImageResult> {
    return serveImage(getRelativePath(item), max, imageOptions);
}

export async function getLogo(imageOptions: ImageOptions): Promise<ImageResult> {
    return serveImage(config.logoRelativePath as string, null, imageOptions);
}

export function getProfile(): ImageProfile {
    if (!config.imageServerUrl || config.imageServerName === 'sharp')
        return sharpProfile;

    return lorisProfile;
}

async function serveImage(relativePath: string, max: number | null,
                          {region, size, rotation, quality, format}: ImageOptions): Promise<ImageResult> {
    size = (size === 'max') ? 'full' : size;

    const encodedPath = encodeURIComponent(relativePath);
    const url = `${config.imageServerUrl}/${encodedPath}/${region}/${size}/${rotation}/${quality}.${format}`;
    const response = await got.default(url, {
        responseType: 'buffer',
        throwHttpErrors: false,
        searchParams: max ? {max} : {},
    });

    return {
        image: (response.statusCode === 200) ? response.body : null,
        status: response.statusCode,
        contentType: (response.statusCode === 200) ? response.headers['content-type'] as string : null,
        contentLength: (response.statusCode === 200) ? parseInt(response.headers['content-length'] as string) : null
    };
}
