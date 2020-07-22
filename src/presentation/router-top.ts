import * as Router from '@koa/router';

import logger from '../lib/Logger';
import config from '../lib/Config';
import {createItem, getAllRootItems} from '../lib/Item';
import {MetadataItem} from '../lib/ItemInterfaces';

import {setContent} from './util';
import {getCollectionWithChildren} from './builder/PresentationBuilder';

const router = new Router({prefix: '/collection'});

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

    const children = await getAllRootItems();

    setContent(ctx, await getCollectionWithChildren(allCollection, children));

    logger.info('Sending all IIIF collections');
});

export default router;
