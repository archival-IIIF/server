import {runTask} from '../../lib/Task.js';
import {evictCache} from '../../lib/Cache.js';
import {deleteItems} from '../../lib/Item.js';
import {Item} from '../../lib/ItemInterfaces.js';
import {CollectionIdParams, MetadataParams, TextItem, TextParams} from '../../lib/ServiceTypes.js';
import {deleteTexts} from '../../lib/Text.js';

export async function cleanup(id: string): Promise<void> {
    await Promise.all([
        deleteItems(id),
        deleteTexts(id),
        evictCache('collection', id),
        evictCache('manifest', id),
        evictCache('annopage', id)
    ]);
}

export function runTasks(collectionId: string, items: Item[], textItems: TextItem[]): void {
    runTask<MetadataParams>('metadata', {collectionId});

    // Run derivative services
    if (items.find(item => item.type === 'audio'))
        runTask<CollectionIdParams>('waveform', {collectionId});
    if (items.find(item => item.type === 'pdf'))
        runTask<CollectionIdParams>('pdf-image', {collectionId});
    if (items.find(item => item.type === 'video'))
        runTask<CollectionIdParams>('video-image', {collectionId});

    for (const textItem of textItems)
        runTask<TextParams>('text', {item: textItem});
}
