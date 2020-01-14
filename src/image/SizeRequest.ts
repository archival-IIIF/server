import {Size, ImageRequest} from './ImageProcessing';
import {RequestError} from './errors';
import {Sharp} from 'sharp';

export default class SizeRequest implements ImageRequest {
    private newSize: { width: number | null, height: number | null } = {width: null, height: null};
    private bestFit = false;
    private isMax = false;

    private static SIZE_TO_WIDTH = /^([0-9]+),$/;
    private static SIZE_TO_HEIGHT = /^,([0-9]+)$/;
    private static SIZE_TO_PERCENTAGE = /^pct:([0-9]+\.?[0-9]*)$/;
    private static SIZE_TO_WIDTH_HEIGHT = /^([0-9]+),([0-9]+)$/;
    private static SIZE_TO_BEST_FIT = /^!([0-9]+),([0-9]+)$/;

    constructor(private request: string) {
    }

    parseImageRequest(size: Size, maxSize?: Size): void {
        if (this.request === 'full' || this.request === 'max')
            this.isMax = true;
        else {
            let result;
            if ((result = SizeRequest.SIZE_TO_WIDTH.exec(this.request)) !== null) {
                [, this.newSize.width] = result.map(i => parseInt(i));
                this.isMax = (this.newSize.width === size.width);
            }
            else if ((result = SizeRequest.SIZE_TO_HEIGHT.exec(this.request)) !== null) {
                [, this.newSize.height] = result.map(i => parseInt(i));
                this.isMax = (this.newSize.height === size.height);
            }
            else if ((result = SizeRequest.SIZE_TO_PERCENTAGE.exec(this.request)) !== null) {
                [, this.newSize.width] = result.map(i => Math.round((size.width / 100) * parseFloat(i)));
                this.isMax = (this.newSize.width === size.width);
            }
            else if ((result = SizeRequest.SIZE_TO_WIDTH_HEIGHT.exec(this.request)) !== null) {
                [, this.newSize.width, this.newSize.height] = result.map(i => parseInt(i));
                this.isMax = (this.newSize.width === size.width) && (this.newSize.height === size.height);
            }
            else if ((result = SizeRequest.SIZE_TO_BEST_FIT.exec(this.request)) !== null) {
                [, this.newSize.width, this.newSize.height] = result.map(i => parseInt(i));
                const isMaxWidth = (size.width > size.height) && (size.width === this.newSize.width);
                const isMaxHeight = (size.height > size.width) && (size.height === this.newSize.height);
                this.isMax = isMaxWidth || isMaxHeight;
                this.bestFit = true;
            }
            else
                throw new RequestError(`Incorrect region request: ${this.request}`);

            if ((this.newSize.width === 0) || (this.newSize.height === 0))
                throw new RequestError('Size width and/or height should not be zero');
        }

        this.updateProcessingInfo(size, maxSize);
    }

    private updateProcessingInfo(size: Size, maxSize?: Size): void {
        if (this.isMax && (!maxSize || (maxSize.width === size.width && maxSize.height === size.height)))
            return;

        if (this.isMax && maxSize) {
            this.isMax = false;
            this.newSize.width = maxSize.width;
            this.newSize.height = maxSize.height;
            return;
        }

        let width = size.width;
        let height = size.height;

        if (this.newSize.width && this.newSize.height && this.bestFit) {
            const newWidth = Math.round(width * this.newSize.height / height);
            const newHeight = Math.round(height * this.newSize.width / width);

            if (newWidth < this.newSize.width) {
                height = Math.round(height * newWidth / width);
                width = newWidth;
            }
            else {
                width = Math.round(width * newHeight / height);
                height = newHeight;
            }
        }
        else if (this.newSize.width && this.newSize.height) {
            width = this.newSize.width;
            height = this.newSize.height;
        }
        else if (this.newSize.width && !this.newSize.height) {
            height = Math.round(height * this.newSize.width / width);
            width = this.newSize.width;
        }
        else if (this.newSize.height && !this.newSize.width) {
            width = Math.round(width * this.newSize.height / height);
            height = this.newSize.height;
        }

        size.width = width;
        size.height = height;
    }

    requiresImageProcessing(): boolean {
        return !this.isMax;
    }

    executeImageProcessing(image: Sharp): void {
        if (this.requiresImageProcessing()) {
            let fit: 'contain' | 'inside' | 'fill' = 'contain';
            if (this.newSize.width && this.newSize.height) fit = 'fill';
            if (this.bestFit) fit = 'inside';
            image.resize(this.newSize.width, this.newSize.height, {fit});
        }
    }
}
