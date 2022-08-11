import {DefaultState} from 'koa';
import Router from '@koa/router';

import logger from '../lib/Logger.js';
import config from '../lib/Config.js';
import {ExtendedContext} from '../lib/Koa.js';
import {MetadataItem} from '../lib/ItemInterfaces.js';
import {createItem, getAllRootItems, withItems} from '../lib/Item.js';

import {setContent} from './util.js';
import {getCollectionWithChildren} from '../builder/PresentationBuilder.js';

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/collection'});

router.get('/top', async ctx => {
    logger.info('Received a request for a top IIIF collection');

    const topCollection = createItem({
        id: 'top',
        collection_id: 'top',
        label: config.attribution || 'Top'
    }) as MetadataItem;

    const children = [
        createItem({
            id: 'all',
            collection_id: 'top',
            label: 'All'
        }),
    ];

    setContent(ctx, await getCollectionWithChildren(topCollection, children));

    logger.info('Sending a top IIIF collection');
});

router.get('/all', async ctx => {
    logger.info('Received a request for all IIIF collections');

    const allCollection = createItem({
        id: 'all',
        collection_id: 'top',
        label: 'All'
    }) as MetadataItem;

    const children = await withItems(getAllRootItems());
    setContent(ctx, await getCollectionWithChildren(allCollection, children));

    logger.info('Sending all IIIF collections');
});
