import {ImageOptions, ImageResult} from './imageServer';
import ImageProcessing, {ImageProcessingInfo} from './ImageProcessing';
import RegionRequest from './RegionRequest';
import SizeRequest from './SizeRequest';
import RotateRequest from './RotateRequest';
import QualityRequest from './QualityRequest';
import FormatRequest from './FormatRequest';
import {RequestError, NotImplementedError} from './errors';

export default async function serveImage(processingInfo: ImageProcessingInfo,
                                         {region, size, rotation, quality, format}: ImageOptions): Promise<ImageResult> {
    const result: ImageResult = {
        image: null,
        status: 200,
        contentType: null,
        contentLength: null
    };

    try {
        const imageProcessing = new ImageProcessing(processingInfo, [
            new RegionRequest(region),
            new SizeRequest(size),
            new RotateRequest(rotation),
            new QualityRequest(quality),
            new FormatRequest(format)
        ]);

        const processedImage = await imageProcessing.process();
        result.image = processedImage.data;
        result.contentLength = processedImage.info.size;
        result.contentType = getContentType(format);
    }
    catch (err) {
        if (err instanceof RequestError)
            result.status = 400;
        else if (err instanceof NotImplementedError)
            result.status = 501;
        else
            throw err;
    }

    return result;
}

function getContentType(extension: string): string | null {
    switch (extension) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'tif':
        case 'tiff':
            return 'image/tiff';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        default:
            return null;
    }
}
