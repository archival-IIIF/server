import {Size} from './imageServer.js';

const SIZE_TO_WIDTH = /^([0-9]+),$/;
const SIZE_TO_HEIGHT = /^,([0-9]+)$/;
const SIZE_TO_PERCENTAGE = /^pct:([0-9]+\.?[0-9]*)$/;
const SIZE_TO_WIDTH_HEIGHT = /^([0-9]+),([0-9]+)$/;
const SIZE_TO_BEST_FIT = /^!([0-9]+),([0-9]+)$/;

interface ParseResult {
    isMax: boolean,
    bestFit: boolean,
    newSize: { width: number | null, height: number | null }
}

export default function parseSize(request: string, size: Size): Size | null {
    const parseResult = parse(request, size);
    return getNewSize(parseResult, size);
}

function parse(request: string, size: Size): ParseResult {
    const parseResult: ParseResult = {
        isMax: false,
        bestFit: false,
        newSize: {width: null, height: null}
    };

    let result;
    if (request === 'full' || request === 'max')
        parseResult.isMax = true;
    else if ((result = SIZE_TO_WIDTH.exec(request)) !== null) {
        [, parseResult.newSize.width] = result.map(i => parseInt(i));
        parseResult.isMax = (parseResult.newSize.width === size.width);
    }
    else if ((result = SIZE_TO_HEIGHT.exec(request)) !== null) {
        [, parseResult.newSize.height] = result.map(i => parseInt(i));
        parseResult.isMax = (parseResult.newSize.height === size.height);
    }
    else if ((result = SIZE_TO_PERCENTAGE.exec(request)) !== null) {
        [, parseResult.newSize.width] = result.map(i => Math.round((size.width / 100) * parseFloat(i)));
        parseResult.isMax = (parseResult.newSize.width === size.width);
    }
    else if ((result = SIZE_TO_WIDTH_HEIGHT.exec(request)) !== null) {
        [, parseResult.newSize.width, parseResult.newSize.height] = result.map(i => parseInt(i));
        parseResult.isMax = (parseResult.newSize.width === size.width) && (parseResult.newSize.height === size.height);
    }
    else if ((result = SIZE_TO_BEST_FIT.exec(request)) !== null) {
        [, parseResult.newSize.width, parseResult.newSize.height] = result.map(i => parseInt(i));
        const isMaxWidth = (size.width > size.height) && (size.width === parseResult.newSize.width);
        const isMaxHeight = (size.height > size.width) && (size.height === parseResult.newSize.height);
        parseResult.isMax = isMaxWidth || isMaxHeight;
        parseResult.bestFit = true;
    }

    return parseResult;
}

function getNewSize(parseResult: ParseResult, size: Size): Size | null {
    if (parseResult.isMax)
        return size;

    if ((parseResult.newSize.width === 0) || (parseResult.newSize.height === 0))
        return null;

    let width = size.width;
    let height = size.height;

    if (parseResult.newSize.width && parseResult.newSize.height && parseResult.bestFit) {
        const newWidth = Math.round(width * parseResult.newSize.height / height);
        const newHeight = Math.round(height * parseResult.newSize.width / width);

        if (newWidth < parseResult.newSize.width)
            return {
                width: newWidth,
                height: Math.round(height * newWidth / width)
            };

        return {
            width: Math.round(width * newHeight / height),
            height: newHeight
        };
    }

    if (parseResult.newSize.width && parseResult.newSize.height)
        return {
            width: parseResult.newSize.width,
            height: parseResult.newSize.height
        };

    if (parseResult.newSize.width && !parseResult.newSize.height)
        return {
            width: parseResult.newSize.width,
            height: Math.round(height * parseResult.newSize.width / width)
        };

    if (parseResult.newSize.height && !parseResult.newSize.width)
        return {
            width: Math.round(width * parseResult.newSize.height / height),
            height: parseResult.newSize.height
        };

    return {
        width: size.width,
        height: size.height
    };
}