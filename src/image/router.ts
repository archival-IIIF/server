import * as Router from 'koa-router';
import {getInfo, getImage} from './imageServer';

import logger from '../lib/Logger';
import {getItem, getChildItems} from '../lib/Item';
import {ImageItem, Item} from '../lib/ItemInterfaces';
import config from '../lib/Config';
import HttpError from '../lib/HttpError';
import {AccessState, hasAccess} from '../lib/Security';
import {cache} from '../lib/Cache';

const prefix = '/iiif/image';
export const router = new Router({prefix});

router.get('/:id', ctx => {
    ctx.status = 303;
    ctx.redirect(`${prefix}/${ctx.params.id}/info.json`);
});

router.get('/:id/info.json', async ctx => {
    const [id, tier] = ctx.params.id.split(config.imageTierSeparator);

    logger.info(`Received a request for image info with id ${id} on tier ${tier}`);

    const item = await determineItem(id);
    if (!item || (item.type !== 'image'))
        throw new HttpError(404, `No image with the id ${id}`);

    const access = await hasAccess(ctx, item, true);
    if (access.state === AccessState.CLOSED)
        ctx.status = 401;
    else if (tier && access.state === AccessState.OPEN)
        ctx.redirect(`${prefix}/${id}/info.json`);
    else if (tier && (access.state === AccessState.TIERED) && (tier !== access.tier.name))
        ctx.redirect(`${prefix}/${id}${config.imageTierSeparator}${access.tier.name}/info.json`);
    else if (!tier && (access.state === AccessState.TIERED))
        ctx.redirect(`${prefix}/${id}${config.imageTierSeparator}${access.tier.name}/info.json`);

    ctx.body = await cache('image', id, ctx.params.id,
        async () => await getInfo(item as ImageItem, access.tier, id));
    switch (ctx.accepts('application/ld+json', 'application/json')) {
        case 'application/json':
            ctx.set('Content-Type', 'application/json');
            break;
        case 'application/ld+json':
        default:
            ctx.set('Content-Type', 'application/ld+json;profile="http://iiif.io/api/image/2/context.json"');
    }

    logger.info(`Sending image info with id ${id} and tier ${tier}`);
});

router.get('/:id/:region/:size/:rotation/:quality.:format', async ctx => {
    const [id, tier] = ctx.params.id.split(config.imageTierSeparator);

    logger.info(`Received a request an image with id ${id} on tier ${tier}`);

    const item = await determineItem(id);
    if (!item || (item.type !== 'image'))
        throw new HttpError(404, `No image with the id ${id}`);

    const access = await hasAccess(ctx, item, false);
    if ((access.state === AccessState.CLOSED) || ((access.state === AccessState.TIERED) && (access.tier.name !== tier)))
        throw new HttpError(401, 'Access denied!');

    const image = await getImage(item as ImageItem, {
        region: ctx.params.region,
        size: ctx.params.size,
        rotation: ctx.params.rotation,
        quality: ctx.params.quality,
        format: ctx.params.format
    }, access.tier);

    ctx.body = image.image;
    ctx.status = image.status;
    if (image.contentType) ctx.set('Content-Type', image.contentType);
    if (image.contentLength) ctx.set('Content-Length', String(image.contentLength));
    ctx.set('Content-Disposition', `inline; filename="${ctx.params.id}-${ctx.params.region}-${ctx.params.size}-${ctx.params.rotation}-${ctx.params.quality}.${ctx.params.format}"`);

    logger.info(`Sending an image with id ${id} and tier ${tier}`);
});

async function determineItem(id: string): Promise<Item | null> {
    const item = await getItem(id);
    if (item && item.type === 'root') {
        const children = await getChildItems(item.id);
        const firstChild = children.find(child => child.order === 1);
        return firstChild || children[0];
    }
    return item;
}

export default router;
