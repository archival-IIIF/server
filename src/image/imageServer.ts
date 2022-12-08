import got from 'got';
import {ImageProfile} from '@archival-iiif/presentation-builder/v2';

import {sharpProfile, lorisProfile} from './profiles.js';

import config from '../lib/Config.js';
import {Item} from '../lib/ItemInterfaces.js';
import {DerivativeType} from '../lib/Derivative.js';
import {getRelativePath, getRelativeDerivativePath} from '../lib/Item.js';

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

export async function getImage(item: Item, derivative: DerivativeType | null, max: number | null,
                               imageOptions: ImageOptions): Promise<ImageResult> {
    if (item.type === 'image')
        return serveImage(getRelativePath(item), max, imageOptions);

    if (derivative)
        return serveImage(getRelativeDerivativePath(item, derivative), max, imageOptions);

    return {
        image: null,
        status: 404,
        contentType: null,
        contentLength: null
    };
}

export async function getLogo(imageOptions: ImageOptions): Promise<ImageResult> {
    return serveImage(config.logoRelativePath as string, null, imageOptions);
}

export async function getAudio(imageOptions: ImageOptions): Promise<ImageResult> {
    return serveImage(config.audioRelativePath as string, null, imageOptions);
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
    const response = await got(url, {
        responseType: 'buffer',
        throwHttpErrors: false,
        timeout: {
            request: 10000
        },
        searchParams: max ? {max} : {},
    });

    return {
        image: response.statusCode === 200 ? response.body : null,
        status: response.statusCode,
        contentType: response.statusCode === 200 ? response.headers['content-type'] as string : null,
        contentLength: response.statusCode === 200 ? parseInt(response.headers['content-length'] as string) : null
    };
}
