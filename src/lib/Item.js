const path = require('path');
const config = require('../lib/Config');
const client = require('../lib/ElasticSearch');

function createItem(obj) {
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
        order: null,
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
        },
        ...obj
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
    while (items.length > 0) {
        const body = [].concat(...items.splice(0, 100).map(item => [
            {update: {_index: 'items', _type: '_doc', _id: item.id}},
            {doc: item, upsert: createItem(item)}
        ]));
        const result = await client.bulk({body});
        if (result.errors)
            throw new Error('Failed to update the items');
    }
}

async function deleteItems(collectionId) {
    await client.deleteByQuery({index: 'items', q: `collection_id:${collectionId}`});
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
    try {
        const response = await client.search({
            index: 'items',
            q: `parent_id:${id}`,
            sort: 'label:asc',
            size: 1000
        });

        return response.hits.hits.map(hit => hit._source);
    }
    catch (err) {
        return [];
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
    createItem,
    indexItems,
    updateItems,
    deleteItems,
    getItem,
    getChildItems,
    getFullPath,
    getRelativePath,
    getPronom,
    getAvailableType
};
