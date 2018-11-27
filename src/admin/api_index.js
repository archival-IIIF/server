const HttpError = require('../lib/HttpError');
const {evictCache} = require('../lib/Cache');
const {createItem, indexItems, deleteItems} = require('../lib/Item');

async function indexCollection(collection) {
    if (!collection.hasOwnProperty('id'))
        throw new HttpError(400, 'ID missing');

    if (!collection.hasOwnProperty('items'))
        throw new HttpError(400, 'Items missing');

    await deleteItems(collection.id);
    await evictCache('collection', collection.id);
    await evictCache('manifest', collection.id);

    const items = [createItem({
        'id': collection.id,
        'collection_id': collection.id,
        'type': 'folder',
        'label': collection.name,
    })];
    items.concat(...collection.items.map(item => createItem(item)));

    await indexItems(items);
}

module.exports = indexCollection;
