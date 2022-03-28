import * as path from 'path';
import logger from './Logger';
import config from './Config';
import {DerivativeType} from './Derivative';
import {Item, MinimalItem} from './ItemInterfaces';
import getClient from './ElasticSearch';

export function createItem(obj: MinimalItem): Item {
    return {
        parent_id: null,
        top_parent_id: null,
        metadata_id: null,
        type: 'metadata',
        formats: [],
        description: null,
        authors: [],
        dates: [],
        physical: null,
        size: null,
        order: null,
        created_at: null,
        width: null,
        height: null,
        resolution: null,
        duration: null,
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

export async function indexItems(items: Item[]): Promise<void> {
    try {
        while (items.length > 0) {
            const body = items
                .splice(0, 100)
                .map(item => [
                    {index: {_index: config.elasticSearchIndexItems, _id: item.id}},
                    item
                ]);

            await getClient().bulk({
                refresh: 'wait_for',
                body: [].concat(...body as [])
            });
        }
    }
    catch (e) {
        throw new Error('Failed to index the items!');
    }
}

export async function updateItems(items: MinimalItem[]): Promise<void> {
    try {
        const uniqueItems = items.filter((item, i) =>
            items.findIndex(otherItem => otherItem.id === item.id) === i);

        while (uniqueItems.length > 0) {
            const body = uniqueItems
                .splice(0, 100)
                .map(item => [
                    {update: {_index: config.elasticSearchIndexItems, _id: item.id}},
                    {doc: item, upsert: createItem(item)}
                ]);

            await getClient().bulk({
                body: [].concat(...body as [])
            });
        }
    }
    catch (e) {
        throw new Error('Failed to update the items!');
    }
}

export async function deleteItems(collectionId: string): Promise<void> {
    await getClient().deleteByQuery({
        index: config.elasticSearchIndexItems,
        q: `collection_id:"${collectionId}"`,
        body: {}
    });
}

export async function getItem(id: string): Promise<Item | null> {
    try {
        logger.debug(`Obtain item from ElasticSearch with id ${id}`);
        const response = await getClient().get({index: config.elasticSearchIndexItems, id: id});
        return response.body._source;
    }
    catch (err) {
        return null;
    }
}

export async function determineItem(id: string): Promise<Item | null> {
    const item = await getItem(id);
    if (item && item.type === 'root') {
        const children = await getChildItems(item);

        const page = item.formats.includes('archive') ? 2 : 1;
        const firstChild = children.find(child => child.order === page);

        return firstChild || children[0];
    }
    return item;
}

export async function getChildItems(item: Item): Promise<Item[]> {
    if (item._childItems === undefined) {
        const items = await withItems(getItems(`parent_id:"${item.id}"`));
        items.sort((cA, cB) =>
            (cA.order !== null && cB.order !== null && cA.order < cB.order) ? -1 : 1);

        for (const childItem of items) {
            childItem._parentItem = item;
            if (item.id === item.collection_id && item.id === childItem.collection_id)
                childItem._rootItem = item;
        }

        item._childItems = items;
    }

    return item._childItems;
}

export async function getChildItemsByType(id: string, type: string): Promise<Item[]> {
    return withItems(getItems(`parent_id:"${id}" AND type:"${type}"`));
}

export async function getRootItemByCollectionId(item: Item): Promise<Item | null> {
    if (item.id === item.collection_id)
        return item;

    if (item._rootItem === undefined) {
        const rootItem = await getItem(item.collection_id);
        item._rootItem = rootItem?.id === rootItem?.collection_id ? rootItem : null;
        if (rootItem?.id === item.parent_id)
            item._parentItem = rootItem;
    }

    return item._rootItem;
}

export async function getCollectionsByMetadataId(id: string): Promise<string[]> {
    const items = await withItems(getItems(`metadata_id:"${id}" AND _exists_:collection_id`));
    return Array.from(new Set(<string[]>items.map(item => item.collection_id)));
}

export async function getCollectionIdsIndexed(ids: string | string[]): Promise<string[]> {
    const query = Array.isArray(ids)
        ? ids.map(id => `collection_id:"${id}"`).join(' OR ')
        : `type:root AND collection_id:${ids}*`;
    const items = await withItems(getItems(query));
    return Array.from(new Set(items.map(item => item.collection_id) as string[]));
}

export function getAllRootItems(): AsyncIterable<Item> {
    return getItems('type:(root OR folder OR metadata) AND NOT _exists_:parent_id');
}

function getItems(q: string): AsyncIterable<Item> {
    logger.debug(`Obtain items from ElasticSearch with query "${q}"`);
    return getClient().helpers.scrollDocuments<Item>({index: config.elasticSearchIndexItems, sort: 'label:asc', q});
}

export function getFullPath(item: Item, type: 'access' | 'original' | null = null): string {
    const relativePath = getRelativePath(item, type);
    return path.join(config.dataRootPath, relativePath);
}

export function getRelativePath(item: Item, type: 'access' | 'original' | null = null): string {
    type = type || getAvailableType(item);

    if (type === 'access')
        return path.join(config.collectionsRelativePath, item.access.uri as string);

    return path.join(config.collectionsRelativePath, item.original.uri as string);
}

export function getFullDerivativePath(item: Item, derivative: DerivativeType): string {
    const relativePath = getRelativeDerivativePath(item, derivative);
    return path.join(config.dataRootPath, relativePath);
}

export function getRelativeDerivativePath(item: Item, derivative: DerivativeType): string {
    return path.join(config.derivativeRelativePath, derivative.type,
        ...item.id.split('-'), `${item.id}.${derivative.extension}`);
}

export function getPronom(item: Item, type: 'access' | 'original' | null = null): string {
    type = type || getAvailableType(item);

    if (type === 'access')
        return item.access.puid as string;

    return item.original.puid as string;
}

export function getAvailableType(item: Item): 'access' | 'original' {
    return item.access.uri ? 'access' : 'original';
}

export function hasType(item: Item, type: 'access' | 'original'): boolean {
    if (type === 'access')
        return !!item.access.uri;

    return !!item.original.uri;
}

// TODO: Replace with Array.fromAsync when available
export async function withItems(asyncItems: AsyncIterable<Item>): Promise<Item[]> {
    const items = [];
    for await (const item of asyncItems)
        items.push(item);
    return items;
}
