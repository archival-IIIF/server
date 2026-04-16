import Router from '@koa/router';
import type {DefaultState} from 'koa';

import logger from '../lib/Logger.ts';
import {runLib} from '../lib/Task.ts';
import {createItem, withItems} from '../lib/Item.ts';

import type {ExtendedContext} from '../lib/Koa.ts';
import type {MetadataItem} from '../lib/ItemInterfaces.ts';
import type {EmptyParams, TopCollection} from '../lib/ServiceTypes.ts';

import {getCollectionWithChildren} from '../builder/PresentationBuilder.ts';

import {setContent} from './util.ts';

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
