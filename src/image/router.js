const Router = require('koa-router');
const imageServer = require('./imageServer');
const {getItem} = require('../lib/Item');
const config = require('../lib/Config');
const HttpError = require('../lib/HttpError');
const {hasAccess} = require('../lib/Security');
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

    const tierWithAccess = await hasAccess(ctx, item);
    if (tierWithAccess === false)
        ctx.status = 401;
    else if (tier && (tierWithAccess === true))
        ctx.redirect(`${prefix}/${id}/info.json`);
    else if (tier && (tierWithAccess !== true) && (tier !== tierWithAccess.name))
        ctx.redirect(`${prefix}/${id}${config.imageTierSeparator}${tierWithAccess.name}/info.json`);
    else if (!tier && (tierWithAccess !== true))
        ctx.redirect(`${prefix}/${id}${config.imageTierSeparator}${tierWithAccess.name}/info.json`);

    ctx.body = await cache('image', id, ctx.params.id, async () => await imageServer.getInfo(item, tierWithAccess));
});

router.get('/:id/:region/:size/:rotation/:quality.:format', async ctx => {
    const [id, tier] = ctx.params.id.split(config.imageTierSeparator);

    const item = await getItem(id);
    if (!item || (item.type !== 'image'))
        throw new HttpError(404, `No image with the id ${id}`);

    const tierWithAccess = await hasAccess(ctx, item);
    if ((tierWithAccess === false) || ((tierWithAccess !== true) && (tierWithAccess.name !== tier)))
        throw new HttpError(401, 'Access denied!');

    const image = await imageServer.getImage(item, tierWithAccess, {
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
