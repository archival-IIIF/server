import {request} from 'undici';
import type {ImageProfile} from '@archival-iiif/presentation-builder/v2';

import {sharpProfile, lorisProfile} from './profiles.ts';

import config from '../lib/Config.ts';
import {getRelativePath, getRelativeDerivativePath} from '../lib/Item.ts';

import type {Item} from '../lib/ItemInterfaces.ts';
import type {DerivativeType} from '../lib/Derivative.ts';

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
    return serveImage(config.logoRelativePath!, null, imageOptions);
}

export async function getAudio(imageOptions: ImageOptions): Promise<ImageResult> {
    return serveImage(config.audioRelativePath!, null, imageOptions);
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
    const {statusCode, headers, body} = await request(url, {
        headersTimeout: 10000,
        bodyTimeout: 10000,
        query: max ? {max} : {},
    });

    return {
        image: statusCode === 200 ? Buffer.from(await body.bytes()) : null,
        status: statusCode,
        contentType: statusCode === 200 ? headers['content-type'] as string : null,
        contentLength: statusCode === 200 ? parseInt(headers['content-length'] as string) : null
    };
}
