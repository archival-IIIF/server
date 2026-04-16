import HttpError from '../lib/HttpError.ts';
import {evictCache} from '../lib/Cache.ts';
import {createItem, indexItems, deleteItems} from '../lib/Item.ts';
import type {Item} from '../lib/ItemInterfaces.ts';

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
