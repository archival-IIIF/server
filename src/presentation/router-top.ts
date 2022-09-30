import {DefaultState} from 'koa';
import Router from '@koa/router';

import logger from '../lib/Logger.js';
import config from '../lib/Config.js';
import {ExtendedContext} from '../lib/Koa.js';
import {Item, MetadataItem} from '../lib/ItemInterfaces.js';
import {createItem, getAllRootItems, withItems} from '../lib/Item.js';

import {setContent} from './util.js';
import {getCollectionWithChildren} from '../builder/PresentationBuilder.js';

interface TopCollection {
    id: string;
    url: string;
    label: string;
    getChildren: () => Promise<Item[]>;
}

const topCollections: TopCollection[] = [{
    id: 'top',
    url: '/top',
    label: config.attribution || 'Top',
    getChildren: async () => [
        createItem({
            id: 'all',
            collection_id: 'top',
            label: 'All'
        })
    ]
}, {
    id: 'all',
    url: '/all',
    label: 'All',
    getChildren: () => withItems(getAllRootItems())
}]

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/collection'});

for (const topCollection of topCollections) {
    router.get(topCollection.url, async ctx => {
        logger.info(`Received a request for '${topCollection.id}' IIIF collection`);

        const collection = createItem({
            id: topCollection.id,
            collection_id: 'top',
            label: topCollection.label
        }) as MetadataItem;

        const children = await topCollection.getChildren();

        setContent(ctx, await getCollectionWithChildren(collection, children));

        logger.info(`Sending '${topCollection.id}' IIIF collection`);
    });
}
