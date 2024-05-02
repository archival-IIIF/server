import {DefaultState} from 'koa';
import Router from '@koa/router';

import logger from '../lib/Logger.js';
import {ExtendedContext} from '../lib/Koa.js';
import {runLib} from '../lib/Task.js';
import {createItem, withItems} from '../lib/Item.js';
import {MetadataItem} from '../lib/ItemInterfaces.js';
import {EmptyParams, TopCollection} from '../lib/ServiceTypes.js';

import {getCollectionWithChildren} from '../builder/PresentationBuilder.js';

import {setContent} from './util.js';

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/collection'});

const topCollections = await runLib<EmptyParams, TopCollection[]>('top-collections', {});
for (const topCollection of topCollections) {
    router.get(topCollection.urlPattern, async ctx => {
        logger.info(`Received a request for '${topCollection.urlPattern}' IIIF collection`);

        const collection = createItem({
            id: topCollection.getId(ctx.params),
            collection_id: 'top',
            label: topCollection.getLabel(ctx.params)
        }) as MetadataItem;

        const children = await withItems(topCollection.getChildren(ctx.params));

        setContent(ctx, await getCollectionWithChildren(collection, children));

        logger.info(`Sending '${topCollection.urlPattern}' IIIF collection`);
    });
}
