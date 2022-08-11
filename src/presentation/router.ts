import Router from '@koa/router';
import {DefaultState} from 'koa';

import logger from '../lib/Logger.js';
import {cache} from '../lib/Cache.js';
import {getItem} from '../lib/Item.js';
import {getText} from '../lib/Text.js';
import HttpError from '../lib/HttpError.js';
import {ExtendedContext} from '../lib/Koa.js';
import {AccessState, hasAccess} from '../lib/Security.js';

import {getAnnotationPage, getCollection, getManifest, isCollection, isManifest} from '../builder/PresentationBuilder.js';

import {setContent} from './util.js';
import {router as routerTop} from './router-top.js';

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/iiif/presentation'});

router.use(routerTop.routes());

router.get('/collection/:id', async ctx => {
    logger.info(`Received a request for a IIIF collection with id ${ctx.params.id}`);

    const item = await getItem(ctx.params.id);
    if (!item || !isCollection(item))
        throw new HttpError(404, `No collection found with id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, true);
    if (access.state === AccessState.CLOSED) {
        ctx.status = 401;
        setContent(ctx, await getCollection(item, access));
        return;
    }

    setContent(
        ctx,
        await cache('collection', item.collection_id, item.id,
            async () => getCollection(item, access))
    );

    logger.info(`Sending a IIIF collection with id ${ctx.params.id}`);
});

router.get('/:id/manifest', async ctx => {
    logger.info(`Received a request for a IIIF manifest with id ${ctx.params.id}`);

    const item = await getItem(ctx.params.id);
    if (!item || !isManifest(item))
        throw new HttpError(404, `No manifest found with id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, true);

    setContent(
        ctx,
        await cache('manifest', item.collection_id, item.id,
            async () => getManifest(item, access))
    );

    logger.info(`Sending a IIIF manifest with id ${ctx.params.id}`);
});

router.get('/:id/annopage/:annoPageId', async ctx => {
    logger.info(`Received a request for a IIIF annotation page with id ${ctx.params.id} and annotation page id ${ctx.params.annoPageId}`);

    const item = await getItem(ctx.params.id);
    if (!item || !isManifest(item))
        throw new HttpError(404, `No manifest found for id ${ctx.params.id}`);

    const text = await getText(ctx.params.annoPageId);
    if (!text)
        throw new HttpError(404, `No annotation page found with id ${ctx.params.annoPageId} in manifest with id ${ctx.params.id}`);

    setContent(
        ctx,
        await cache('annopage', item.collection_id, item.id,
            async () => getAnnotationPage(item, text))
    );

    logger.info(`Sending a IIIF annotation page with id ${ctx.params.id} and annotation page id ${ctx.params.annoPageId}`);
});
