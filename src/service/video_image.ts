import config from '../lib/Config';
import derivatives from '../lib/Derivative';
import {VideoItem} from '../lib/ItemInterfaces';
import {DerivativeParams} from '../lib/Service';
import {getChildItemsByType} from '../lib/Item';

import {createDerivativeWithCommand, createDerivativeWithBuffer} from './util/derivative_creation';
import {imageResourceUri} from '../builder/UriHelper';

const timestamp = (seconds: number) => new Date(seconds * 1000).toISOString().substring(11, 23);

export default async function processVideoItems({collectionId}: DerivativeParams): Promise<void> {
    try {
        const items = await getChildItemsByType(collectionId, 'video');
        for (const item of items) {
            await createImage(item as VideoItem);
            await createMosaic(item as VideoItem);
        }
    }
    catch (e: any) {
        const err = new Error(`Failed to process the pdf items for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

async function createImage(item: VideoItem): Promise<void> {
    const seconds = Math.round(item.duration / 2);
    await createDerivativeWithCommand(item, derivatives['video-image'],
        (input, output) => `ffmpeg -y -ss ${seconds} -i ${input} -frames:v 1 -an ${output}`);
}

async function createMosaic(item: VideoItem): Promise<void> {
    const height = Math.round(item.height * (config.videoMosaicWidth / item.width));
    const noImages = config.videoTilesColumns * config.videoTilesRows;
    const seconds = Math.round(item.duration / noImages);

    const scale = `scale=${config.videoMosaicWidth}:${height}`;
    const select = `select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,${seconds})'`;
    const tile = `tile=layout=${config.videoTilesColumns}x${config.videoTilesRows}`;

    await createDerivativeWithCommand(item, derivatives['video-mosaic'],
        (input, output) =>
            `ffmpeg -y -i ${input} -vf ${select},${scale},${tile} -frames:v 1 -an ${output}`);

    let curSeconds = 0, x = 0, y = 0, webvtt = 'WEBVTT\n\n';
    for (let i = 0; i < noImages; i++) {
        const c = i % config.videoTilesColumns;

        x = c === 0 ? 0 : x + config.videoMosaicWidth;
        y = i !== 0 && c === 0 ? y + height : y;

        const start = timestamp(curSeconds);
        curSeconds += seconds;
        const end = timestamp(curSeconds);

        webvtt += `${start} --> ${end}\n`;

        const xywh = `${x},${y},${config.videoMosaicWidth},${height}`;
        webvtt += imageResourceUri(item.id, 'mosaic') + `#xywh=${xywh}`;

        if (i < (noImages - 1))
            webvtt += '\n\n';
    }

    await createDerivativeWithBuffer(item, derivatives['video-mosaic-vtt'], Buffer.from(webvtt));
}
