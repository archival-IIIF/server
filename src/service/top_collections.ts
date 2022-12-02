import config from '../lib/Config.js';
import {EmptyParams, TopCollection} from '../lib/ServiceTypes.js';
import {createItem, getAllRootItems, withItems} from '../lib/Item.js';

export default async function getTopCollections(noParams?: EmptyParams): Promise<TopCollection[]> {
    return [{
        urlPattern: '/top',
        getId: () => 'top',
        getLabel: () => config.attribution || 'Top',
        getChildren: async () => [
            createItem({
                id: 'all',
                collection_id: 'top',
                label: 'All'
            })
        ]
    }, {
        urlPattern: '/all',
        getId: () => 'all',
        getLabel: () => 'All',
        getChildren: () => withItems(getAllRootItems())
    }];
}
