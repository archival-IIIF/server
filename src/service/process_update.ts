import {search} from '../lib/ElasticSearch';
import {Item} from '../lib/ItemInterfaces';
import {runTask} from '../lib/Task';
import {ProcessUpdateParams, MetadataParams, WaveformParams} from '../lib/Service';

export default async function processUpdate({type, query}: ProcessUpdateParams): Promise<void> {
    const items: Item[] = await search<Item>('items', query);
    items.forEach(item => {
        switch (type) {
            case 'metadata':
                runTask<MetadataParams>('metadata', {collectionId: item.collection_id});
                break;
            case 'waveform':
                runTask<WaveformParams>('waveform', {collectionId: item.collection_id});
                break;
        }
    });
}
