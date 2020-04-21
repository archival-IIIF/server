import {search} from '../lib/ElasticSearch';
import {Item} from '../lib/ItemInterfaces';
import {runTask} from '../lib/Task';
import {MetadataParams} from '../lib/Service';

export default async function processUpdateWithNPrefix(): Promise<void> {
    const items: Item[] = await search<Item>('items', 'type:"root" AND NOT _exists_:metadata_id AND id:N30051*');
    items.forEach(item => {
        runTask<MetadataParams>('metadata', {collectionId: item.collection_id});
    });
}
