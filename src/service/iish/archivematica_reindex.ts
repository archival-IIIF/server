import config from '../../lib/Config.js';
import getClient from '../../lib/ElasticSearch.js';
import {runTask} from '../../lib/Task.js';
import {Item} from '../../lib/ItemInterfaces.js';
import {getFullPath, getItemsSearch} from '../../lib/Item.js';
import {CollectionPathParams, ReindexParams} from '../../lib/ServiceTypes.js';

export default async function processReindex({collectionIds, query}: ReindexParams): Promise<void> {
    if (query) {
        const scrollItems = getClient().helpers.scrollDocuments<Item>({
            index: config.elasticSearchIndexItems,
            size: 10_000,
            q: query
        });

        for await (const item of scrollItems)
            runTask<CollectionPathParams>('index', {collectionPath: getPathForItem(item)});
    }

    if (collectionIds) {
        for (const collectionId of collectionIds) {
            const items = await getItemsSearch(`parent_id:"${collectionId}"`, 1);
            for (const item of items)
                runTask<CollectionPathParams>('index', {collectionPath: getPathForItem(item)});
        }
    }
}

function getPathForItem(item: Item): string {
    const fullPath = getFullPath(item);
    return fullPath.substring(0, fullPath.indexOf('/objects'));
}
