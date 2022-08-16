import config from '../lib/Config.js';
import {runTask} from '../lib/Task.js';
import {Item} from '../lib/ItemInterfaces.js';
import getClient from '../lib/ElasticSearch.js';
import {ProcessUpdateParams, MetadataParams, DerivativeParams} from '../lib/Service.js';

export default async function processUpdate({type, query}: ProcessUpdateParams): Promise<void> {
    const scrollItems = getClient().helpers.scrollDocuments<Item>({
        index: config.elasticSearchIndexItems,
        size: 10_000,
        q: query
    });

    for await (const item of scrollItems)
        runTask<MetadataParams | DerivativeParams>(type, {collectionId: item.collection_id});
}
