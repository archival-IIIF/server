const HttpError = require('../lib/HttpError');
const {evictCache} = require('../lib/Cache');
const {indexItems, deleteItems} = require('../lib/Item');

async function indexCollection(collection) {
    if (!collection.hasOwnProperty('id'))
        throw new HttpError(400, 'ID missing');

    if (!collection.hasOwnProperty('items'))
        throw new HttpError(400, 'Items missing');

    await deleteItems(collection.id);
    await evictCache('collection', collection.id);
    await evictCache('manifest', collection.id);

    const items = [{
        'id': collection.id,
        'parent_id': null,
        'collection_id': collection.id,
        'type': 'folder',
        'label': collection.name,
        'size': null,
        'created_at': null,
        'width': null,
        'height': null,
        'original': {
            'uri': null,
            'puid': null
        },
        'access': {
            'uri': null,
            'puid': null
        }
    }];
    items.concat(...collection.items);

    await indexItems(items);
}

module.exports = indexCollection;
