import config from '../lib/Config.ts';
import {createItem, getAllRootItems} from '../lib/Item.ts';
import type {EmptyParams, TopCollection} from '../lib/ServiceTypes.ts';

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
        }
    }, {
        urlPattern: '/all',
        getId: () => 'all',
        getLabel: () => 'All',
        getChildren: () => getAllRootItems()
    }];
}
