const {pg, db} = require('../lib/DB');
const HttpError = require('../lib/HttpError');
const {evictCache} = require('../lib/Cache');

const columnSet = new pg.helpers.ColumnSet([
    'id',
    'parent_id',
    'container_id',
    'metadata',
    'type',
    'label',
    'size',
    'created_at',
    'width',
    'height',
    'original_resolver',
    'original_pronom',
    'access_resolver',
    'access_pronom'
]);

async function importCollection(collection) {
    if (!collection.hasOwnProperty('id'))
        throw new HttpError(400, 'ID missing');

    if (!collection.hasOwnProperty('items'))
        throw new HttpError(400, 'Items missing');

    const result = await db.result("SELECT id FROM items WHERE container_id = $1", [collection.id]);
    if (result.rowCount > 0) {
        await db.none("DELETE FROM items WHERE container_id = $1;", [collection.id]);

        await evictCache('collection', collection.id);
        await evictCache('manifest', collection.id);
    }

    const items = [{
        'id': collection.id,
        'parent_id': null,
        'container_id': collection.id,
        'metadata': null,
        'type': 'folder',
        'label': collection.name,
        'size': null,
        'created_at': null,
        'width': null,
        'height': null,
        'original_resolver': null,
        'original_pronom': null,
        'access_resolver': null,
        'access_pronom': null
    }];

    collection.items.forEach(item => {
        const p = {
            id: item.id,
            parent_id: item.parent ? item.parent : item.id,
            container_id: collection.id,
            metadata: item.metadata,
            type: item.type,
            label: item.label,
            size: null,
            created_at: null,
            width: null,
            height: null,
            original_resolver: null,
            original_pronom: null,
            access_resolver: null,
            access_pronom: null
        };

        if (item.type !== 'folder') {
            p.label = item.name;
            p.size = item.size;
            p.created_at = item.created_at;
            p.width = item.width;
            p.height = item.height;

            if (item.original) {
                p.original_pronom = item.original.pronom;
                p.original_resolver = item.original.resolver;
            }

            if (item.access) {
                p.access_pronom = item.access.pronom;
                p.access_resolver = item.access.resolver;
            }
        }

        items.push(p);
    });

    const sql = pg.helpers.insert(items, columnSet, 'items');
    await db.none(sql, items);
}

module.exports = importCollection;
