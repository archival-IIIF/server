const Router = require('koa-router');
const imageServer = require('./imageServer');
const {getItem} = require('../lib/Item');
const config = require('../lib/Config');
const HttpError = require('../lib/HttpError');
const {AccessState, hasAccess} = require('../lib/Security');
const {cache} = require('../lib/Cache');

const prefix = '/iiif/image';
const router = new Router({prefix});

router.get('/:id', ctx => {
    ctx.status = 303;
    ctx.redirect(`${prefix}/${ctx.params.id}/info.json`);
});

router.get('/:id/info.json', async ctx => {
    const [id, tier] = ctx.params.id.split(config.imageTierSeparator);

    const item = await getItem(id);
    if (!item || (item.type !== 'image'))
        throw new HttpError(404, `No image with the id ${id}`);

    const access = await hasAccess(ctx, item);
    if (access.state === AccessState.CLOSED)
        ctx.status = 401;
    else if (tier && access.state === AccessState.OPEN)
        ctx.redirect(`${prefix}/${id}/info.json`);
    else if (tier && (access.state === AccessState.TIERED) && (tier !== access.tier.name))
        ctx.redirect(`${prefix}/${id}${config.imageTierSeparator}${access.tier.name}/info.json`);
    else if (!tier && (access.state === AccessState.TIERED))
        ctx.redirect(`${prefix}/${id}${config.imageTierSeparator}${access.tier.name}/info.json`);

    ctx.body = await cache('image', id, ctx.params.id, async () => await imageServer.getInfo(item, access.tier));
});

router.get('/:id/:region/:size/:rotation/:quality.:format', async ctx => {
    const [id, tier] = ctx.params.id.split(config.imageTierSeparator);

    const item = await getItem(id);
    if (!item || (item.type !== 'image'))
        throw new HttpError(404, `No image with the id ${id}`);

    const access = await hasAccess(ctx, item);
    if ((access.state === AccessState.CLOSED) || ((access.state === AccessState.TIERED) && (access.tier.name !== tier)))
        throw new HttpError(401, 'Access denied!');

    const image = await imageServer.getImage(item, access.tier, {
        region: ctx.params.region,
        size: ctx.params.size,
        rotation: ctx.params.rotation,
        quality: ctx.params.quality,
        format: ctx.params.format
    });

    ctx.body = image.image;
    ctx.status = image.status;
    ctx.set('Content-Type', image.contentType);
    ctx.set('Content-Length', image.contentLength);
});

module.exports = router;
