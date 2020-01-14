import {join} from 'path';
import * as sharp from 'sharp';

export interface ImageRequest {
    parseImageRequest(size: Size, maxSize?: Size): void;
    requiresImageProcessing(): boolean;
    executeImageProcessing(image: sharp.Sharp): void;
}

export interface ImageProcessingInfo {
    rootPath: string,
    relativePath: string;
    size?: Size;
    maxSize?: Size;
}

export interface Size {
    width: number;
    height: number;
}

export default class ImageProcessing {
    constructor(private processingInfo: ImageProcessingInfo, private requests: ImageRequest[]) {
    }

    async process(): Promise<{ data: Buffer, info: sharp.OutputInfo }> {
        const size = this.processingInfo.size || await this.getSize();
        this.requests.forEach(request => request.parseImageRequest(size, this.processingInfo.maxSize));

        const pipeline = this.getPipeline();
        if (this.requests.filter(request => request.requiresImageProcessing()).length > 0)
            this.requests.forEach(request => request.executeImageProcessing(pipeline));

        return pipeline.toBuffer({resolveWithObject: true});
    }

    private getPipeline(): sharp.Sharp {
        return sharp(join(this.processingInfo.rootPath, this.processingInfo.relativePath));
    }

    private async getSize(): Promise<Size> {
        const pipeline = this.getPipeline();
        const metadata = await pipeline.metadata();
        return {width: metadata.width as number, height: metadata.height as number};
    }
}
