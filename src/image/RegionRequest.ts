import {Size, ImageRequest} from './ImageProcessing';
import {RequestError} from './errors';
import {Sharp} from 'sharp';

export default class RegionRequest implements ImageRequest {
    private left: number = 0;
    private top: number = 0;
    private width: number = 0;
    private height: number = 0;
    private isSquare = false;
    private isFull = false;

    private static REGION_IN_PIXELS =
        /^([0-9]+),([0-9]+),([0-9]+),([0-9]+)$/;
    private static REGION_IN_PERCENTAGES =
        /^pct:([0-9]+\.?[0-9]*),([0-9]+\.?[0-9]*),([0-9]+\.?[0-9]*),([0-9]+\.?[0-9]*)$/;

    constructor(private request: string) { }

    parseImageRequest(size: Size): void {
        if (this.request === 'full') {
            this.isFull = true;
            return;
        }

        if (this.request === 'square') {
            this.isSquare = true;

            if (size.width === size.height)
                this.isFull = true;
            else {
                const shortestDimension = Math.min(size.width, size.height);
                size.width = shortestDimension;
                size.height = shortestDimension;
            }

            this.width = size.width;
            this.height = size.height;

            return;
        }

        const imageSize = size;

        let result;
        if ((result = RegionRequest.REGION_IN_PIXELS.exec(this.request)) !== null) {
            [, this.left, this.top, this.width, this.height] = result.map(i => parseInt(i));
        }
        else if ((result = RegionRequest.REGION_IN_PERCENTAGES.exec(this.request)) !== null) {
            [, this.left, , this.width] = result.map(i => Math.round((imageSize.width / 100) * parseFloat(i)));
            [, , this.top, , this.height] = result.map(i => Math.round((imageSize.height / 100) * parseFloat(i)));
        }
        else
            throw new RequestError(`Incorrect region request: ${this.request}`);

        if (this.left < 0) this.left = 0;
        if (this.top < 0) this.top = 0;

        if ((this.width + this.left) > imageSize.width) this.width = imageSize.width - this.left;
        if ((this.height + this.top) > imageSize.height) this.height = imageSize.height - this.top;

        if ((this.width === 0) || (this.height === 0))
            throw new RequestError('Region width and/or height should not be zero');

        if ((this.left > imageSize.width) || (this.top > imageSize.height))
            throw new RequestError('Region is entirely outside the bounds');

        const isUpperLeftCorner = ((this.left === 0) && (this.top === 0));
        const isFullWidthAndHeight = ((this.width === imageSize.width) && (this.height === imageSize.height));
        if (isUpperLeftCorner && isFullWidthAndHeight)
            this.isFull = true;
        else {
            size.width = this.width;
            size.height = this.height;
        }
    }

    requiresImageProcessing(): boolean {
        return !this.isFull;
    }

    executeImageProcessing(image: Sharp): void {
        if (this.requiresImageProcessing()) {
            if (this.isSquare)
                image.resize(this.width, this.height, {fit: 'cover', position: 'attention'});
            else
                image.extract({left: this.left, top: this.top, width: this.width, height: this.height});
        }
    }
}
