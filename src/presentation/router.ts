import Router from '@koa/router';

import logger from '../lib/Logger';
import {cache} from '../lib/Cache';
import {getItem} from '../lib/Item';
import HttpError from '../lib/HttpError';
import {AccessState, hasAccess} from '../lib/Security';

import {getCollection, getManifest, isCollection, isManifest} from '../builder/PresentationBuilder';

import {setContent} from './util';
import routerTop from './router-top';

const router = new Router({prefix: '/iiif/presentation'});

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
        await cache('collection', item.collection_id, item.id, async () => await getCollection(item, access))
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
        await cache('manifest', item.collection_id, item.id, async () => await getManifest(item, access))
    );

    logger.info(`Sending a IIIF manifest with id ${ctx.params.id}`);
});

export default router;
