import {runTask} from '../lib/Task';
import {Item} from '../lib/ItemInterfaces';
import {search} from '../lib/ElasticSearch';
import {ProcessUpdateParams, MetadataParams, DerivativeParams} from '../lib/Service';

export default async function processUpdate({type, query}: ProcessUpdateParams): Promise<void> {
    const items: Item[] = await search<Item>('items', query);
    for (const item of items) {
        switch (type) {
            case 'metadata':
                runTask<MetadataParams>('metadata', {collectionId: item.collection_id});
                break;
            case 'waveform':
                runTask<DerivativeParams>('waveform', {collectionId: item.collection_id});
                break;
            case 'pdf-image':
                runTask<DerivativeParams>('pdf-image', {collectionId: item.collection_id});
                break;
            case 'video-image':
                runTask<DerivativeParams>('video-image', {collectionId: item.collection_id});
                break;
        }
    }
}
