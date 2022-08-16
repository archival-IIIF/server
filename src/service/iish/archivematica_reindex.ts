import config from '../../lib/Config.js';
import getClient from '../../lib/ElasticSearch.js';
import {runTask} from '../../lib/Task.js';
import {Item} from '../../lib/ItemInterfaces.js';
import {getFullPath, getItems} from '../../lib/Item.js';
import {IndexParams, ReindexParams} from '../../lib/Service.js';

export default async function processReindex({collectionIds, query}: ReindexParams): Promise<void> {
    if (query) {
        const scrollItems = getClient().helpers.scrollDocuments<Item>({
            index: config.elasticSearchIndexItems,
            size: 10_000,
            q: query
        });

        for await (const item of scrollItems)
            runTask<IndexParams>('index', {collectionPath: getPathForItem(item)});
    }

    if (collectionIds) {
        for (const collectionId of collectionIds) {
            const scrollItems = await getItems(`parent_id:"${collectionId}"`, {size: 1, sort: false});
            for await (const item of scrollItems)
                runTask<IndexParams>('index', {collectionPath: getPathForItem(item)});
        }
    }
}

function getPathForItem(item: Item): string {
    const fullPath = getFullPath(item);
    return fullPath.substring(0, fullPath.indexOf('/objects'));
}
