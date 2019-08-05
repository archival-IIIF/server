import * as request from 'request-promise-native';

import config from '../lib/Config';

import {ImageProcessingInfo} from './ImageProcessing';
import {ImageOptions, ImageResult} from './imageServer';

export default async function serveImage(processingInfo: ImageProcessingInfo,
                                         {region, size, rotation, quality, format}: ImageOptions): Promise<ImageResult> {
    const url = `${config.imageServerUrl}/${processingInfo.relativePath}/${region}/${size}/${rotation}/${quality}.${format}`;
    const response = await request({uri: url, encoding: null, resolveWithFullResponse: true, simple: false});

    const result = {
        image: null,
        status: response.statusCode,
        contentType: null,
        contentLength: null
    };

    if (response.statusCode === 200) {
        result.image = response.body;
        result.contentType = response.headers['content-type'];
        result.contentLength = response.headers['content-length'];
    }

    return result;
}
