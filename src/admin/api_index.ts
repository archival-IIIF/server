import HttpError from '../lib/HttpError';
import {evictCache} from '../lib/Cache';
import {Item} from '../lib/ItemInterfaces';
import {createItem, indexItems, deleteItems} from '../lib/Item';
import config from "../lib/Config";

export default async function indexCollection(collection: { id?: string; name?: string, items?: Item[] }): Promise<void> {
    if (!('id' in collection) || !collection.id)
        throw new HttpError(400, 'ID missing');

    if (!('items' in collection) || !collection.items)
        throw new HttpError(400, 'Items missing');

    await deleteItems(collection.id);
    await evictCache('collection', collection.id);
    await evictCache('manifest', collection.id);

    const items = [createItem({
        'id': collection.id,
        'collection_id': collection.id,
        'type': 'folder',
        'label': collection.name || collection.id,
    })];
    items.concat(...collection.items.map(item => createItem(item)));

    await indexItems(items);
}
