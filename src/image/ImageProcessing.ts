import * as sharp from 'sharp';

export interface ImageRequest {
    parseImageRequest(processingInfo: ImageProcessingInfo): void;
    requiresImageProcessing(): boolean;
    executeImageProcessing(image: sharp.Sharp): void;
}

export interface ImageProcessingInfo {
    fullPath: string;
    relativePath: string;
    size: Size;
}

export interface Size {
    width: number;
    height: number;
}

export default class ImageProcessing {
    constructor(private processingInfo: ImageProcessingInfo, private requests: ImageRequest[]) {
        this.requests.forEach(request => request.parseImageRequest(this.processingInfo));
    }

    async process(): Promise<{ data: Buffer, info: sharp.OutputInfo }> {
        const image = sharp(this.processingInfo.fullPath);
        if (this.requests.filter(request => request.requiresImageProcessing()).length > 0)
            this.requests.forEach(request => request.executeImageProcessing(image));
        return await image.toBuffer({resolveWithObject: true});
    }
}
