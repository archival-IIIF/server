import config from '../lib/Config.ts';
import {runTask} from '../lib/Task.ts';
import getClient from '../lib/ElasticSearch.ts';

import type {Item} from '../lib/ItemInterfaces.ts';
import type {ProcessUpdateParams, MetadataParams, CollectionIdParams} from '../lib/ServiceTypes.ts';

export default async function processUpdate({type, query}: ProcessUpdateParams): Promise<void> {
    const scrollItems = getClient().helpers.scrollDocuments<Item>({
        index: config.elasticSearchIndexItems,
        size: 10_000,
        q: query
    });

    for await (const item of scrollItems)
        runTask<MetadataParams | CollectionIdParams>(type, {collectionId: item.collection_id});
}
