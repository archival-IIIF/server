import config from '../../lib/Config.ts';
import getClient from '../../lib/ElasticSearch.ts';
import {createItem, getAllRootItems, getItems} from '../../lib/Item.ts';

import type {Item} from '../../lib/ItemInterfaces.ts';
import type {EmptyParams, TopCollection} from '../../lib/ServiceTypes.ts';

const fromParam = (param: string): string => param.replaceAll('_', ' ');
const toParam = (param: string): string => param.replaceAll(' ', '_');
const capitalizeFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export default async function getTopCollections(noParams?: EmptyParams): Promise<TopCollection[]> {
    return [{
        urlPattern: '/top',
        getId: () => 'top',
        getLabel: () => config.attribution || 'Top',
        getChildren: async function* () {
            yield createItem({
                id: 'all',
                collection_id: 'top',
                label: 'All'
            });
            yield createItem({
                id: 'format',
                collection_id: 'top',
                label: 'By format'
            });
        }
    }, {
        urlPattern: '/all',
        getId: () => 'all',
        getLabel: () => 'All',
        getChildren: () => getAllRootItems(['id', 'type', 'label'])
    }, {
        urlPattern: '/format',
        getId: () => 'format',
        getLabel: () => 'By format',
        getChildren: getFormats
    }, {
        urlPattern: '/format/:format',
        getId: params => `format/${params.format}`,
        getLabel: params => capitalizeFirst(fromParam(params.format)),
        getChildren: params => getItems(`formats:${fromParam(params.format)}`)
    }];
}

async function* getFormats(): AsyncIterable<Item> {
    const formats = await getClient().search<unknown, Record<'formats', any>>({
        index: config.elasticSearchIndexItems,
        size: 0,
        aggs: {
            formats: {
                terms: {
                    field: 'formats',
                    size: 10
                }
            }
        }
    });

    const buckets = (formats.aggregations?.formats?.buckets) || [];
    for (const bucket of buckets) {
        yield createItem({
            id: `format/${toParam(bucket.key)}`,
            collection_id: 'top',
            label: capitalizeFirst(bucket.key)
        });
    }
}
