import {getFullPath} from '../../lib/Item.ts';
import {getAudioMetadata, getImageMetadata, getVideoMetadata} from '../../lib/MediaInfo.ts';

import type {Item} from '../../lib/ItemInterfaces.ts';

export async function fixMissingMetadata(items: Item[]): Promise<void> {
    for (const item of items) {
        if (item.type === 'image' && (!item.width || !item.height)) {
            const imageMetadata = await getImageMetadata(getFullPath(item));
            item.width ??= imageMetadata.width || null;
            item.height ??= imageMetadata.height || null;
        }

        if (item.type === 'audio' && !item.duration) {
            const audioMetadata = await getAudioMetadata(getFullPath(item));
            item.duration ??= audioMetadata.duration || null;
        }

        if (item.type === 'video' && (!item.width || !item.height || !item.duration)) {
            const videoMetadata = await getVideoMetadata(getFullPath(item));
            item.width ??= videoMetadata.width || null;
            item.height ??= videoMetadata.height || null;
            item.duration ??= videoMetadata.duration || null;
        }
    }
}
