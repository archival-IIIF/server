import HttpError from '../lib/HttpError.js';
import {evictCache} from '../lib/Cache.js';
import {Item} from '../lib/ItemInterfaces.js';
import {createItem, indexItems, deleteItems} from '../lib/Item.js';

export default async function indexCollection(collection: { id?: string; name?: string, items?: Item[] }): Promise<void> {
    if (!('id' in collection) || !collection.id)
        throw new HttpError(400, 'ID missing');

    if (!('items' in collection) || !collection.items)
        throw new HttpError(400, 'Items missing');

    await Promise.all([
        deleteItems(collection.id),
        evictCache('collection', collection.id),
        evictCache('manifest', collection.id),
        evictCache('annopage', collection.id)
    ]);

    const items = [createItem({
        'id': collection.id,
        'collection_id': collection.id,
        'type': 'folder',
        'label': collection.name || collection.id,
    })];
    items.concat(...collection.items.map(item => createItem(item)));

    await indexItems(items);
}
