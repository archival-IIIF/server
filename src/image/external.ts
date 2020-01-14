import * as got from 'got';

import config from '../lib/Config';

import {ImageProcessingInfo} from './ImageProcessing';
import {ImageOptions, ImageResult} from './imageServer';

export default async function serveImage(processingInfo: ImageProcessingInfo,
                                         {region, size, rotation, quality, format}: ImageOptions): Promise<ImageResult> {
    size = (size === 'max') ? 'full' : size;
    const encodedPath = encodeURIComponent(processingInfo.relativePath);
    const url = `${config.imageServerUrl}/${encodedPath}/${region}/${size}/${rotation}/${quality}.${format}`;
    const response = await got.default(url, {responseType: 'buffer', throwHttpErrors: false});

    const result: ImageResult = {
        image: null,
        status: response.statusCode,
        contentType: null,
        contentLength: null
    };

    if (response.statusCode === 200) {
        result.image = response.body;
        result.contentType = response.headers['content-type'] as string;
        result.contentLength = parseInt(response.headers['content-length'] as string);
    }

    return result;
}
