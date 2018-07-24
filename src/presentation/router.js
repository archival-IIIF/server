const Router = require('koa-router');
const cache = require('../lib/Cache');
const HttpError = require('../lib/HttpError');
const presentationBuilder = require('./PresentationBuilder');

const router = new Router({prefix: '/iiif/presentation'});

router.get('/collection/:id', async ctx => {
    const collection = await cache('collection', ctx.params.id,
        async () => await presentationBuilder.getCollection(ctx.params.id));
    if (!collection)
        throw new HttpError(404, `No collection found with id ${ctx.params.id}`);

    ctx.set('Content-Type', 'application/json; charset=utf-8');
    ctx.body = collection;
});

router.get('/:id/manifest', async ctx => {
    const manifest = await cache('manifest', ctx.params.id,
        async () => await presentationBuilder.getManifest(ctx.params.id));
    if (!manifest)
        throw new HttpError(404, `No manifest found with id ${ctx.params.id}`);

    ctx.set('Content-Type', 'application/json; charset=utf-8');
    ctx.body = manifest;
});

module.exports = router;
