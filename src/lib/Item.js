const path = require('path');
const config = require('../lib/Config');
const client = require('../lib/ElasticSearch');

function getEmptyItem() {
    return {
        id: null,
        parent_id: null,
        collection_id: null,
        metadata_id: null,
        type: null,
        label: null,
        description: null,
        authors: [],
        language: null,
        size: null,
        created_at: null,
        width: null,
        height: null,
        metadata: [],
        original: {
            uri: null,
            puid: null
        },
        access: {
            uri: null,
            puid: null
        }
    };
}

async function indexItems(items) {
    while (items.length > 0) {
        const body = [].concat(...items.splice(0, 100).map(item => [
            {index: {_index: 'items', _type: '_doc', _id: item.id}},
            item
        ]));
        const result = await client.bulk({body});
        if (result.errors)
            throw new Error('Failed to index the items');
    }
}

async function updateItems(items) {
    const uniqueItems = items.filter((item, i) => items.findIndex(otherItem => otherItem.id === item.id) === i);
    while (uniqueItems.length > 0) {
        const body = [].concat(...uniqueItems.splice(0, 100).map(item => [
            {update: {_index: 'items', _type: '_doc', _id: item.id}},
            {doc: item, upsert: {...getEmptyItem(), ...item}}
        ]));
        const result = await client.bulk({body});
        if (result.errors)
            throw new Error('Failed to update the items');
    }
}

async function deleteItems(collectionId) {
    await client.deleteByQuery({index: 'items', q: `collection_id:"${collectionId}"`});
}

async function getItem(id) {
    try {
        const response = await client.get({index: 'items', type: '_doc', id: id});
        return response._source;
    }
    catch (err) {
        return null;
    }
}

async function getChildItems(id) {
    return getItems(`parent_id:"${id}"`);
}

async function getRootItemByCollectionId(id) {
    const items = await getItems(`id:"${id}" AND collection_id:"${id}"`);
    return (items.length > 0) ? items[0] : null;
}

async function getCollectionsByMetadataId(id) {
    const items = await getItems(`metadata_id:"${id}" AND _exists_:collection_id`);
    return Array.from(new Set(items.map(item => item.collection_id)));
}

async function getItems(q) {
    const items = [];

    try {
        let {_scroll_id, hits} = await client.search({
            index: 'items',
            sort: 'label:asc',
            size: 1000,
            scroll: '10s',
            q
        });

        while (hits && hits.hits.length) {
            items.push(...hits.hits.map(hit => hit._source));

            const scrollResults = await client.scroll({scroll_id: _scroll_id, scroll: '10s'});
            _scroll_id = scrollResults._scroll_id;
            hits = scrollResults.hits;
        }

        return items;
    }
    catch (err) {
        return items;
    }
}

function getFullPath(item, type = null) {
    const relativePath = getRelativePath(item, type);
    return relativePath ? path.join(config.dataPath, relativePath) : null;
}

function getRelativePath(item, type = null) {
    type = type || getAvailableType(item);

    if (type === 'access')
        return item.access.uri;

    if (type === 'original')
        return item.original.uri;
}

function getPronom(item, type = null) {
    type = type || getAvailableType(item);

    if (type === 'access')
        return item.access.puid;

    if (type === 'original')
        return item.original.puid;
}

function getAvailableType(item) {
    return item.access.uri ? 'access' : 'original';
}

module.exports = {
    getEmptyItem,
    indexItems,
    updateItems,
    deleteItems,
    getItem,
    getChildItems,
    getRootItemByCollectionId,
    getCollectionsByMetadataId,
    getFullPath,
    getRelativePath,
    getPronom,
    getAvailableType
};
