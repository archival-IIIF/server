const Router = require('koa-router');
const db = require('../lib/DB');
const {cache} = require('../lib/Cache');
const HttpError = require('../lib/HttpError');
const presentationBuilder = require('./PresentationBuilder');

const router = new Router({prefix: '/iiif/presentation'});

router.get('/collection/:id', async ctx => {
    const containerId = await findContainerId(ctx.params.id);
    if (!containerId)
        throw new HttpError(404, `No collection found with id ${ctx.params.id}`);

    const collectionBuilder = async () => await presentationBuilder.getCollection(ctx.params.id);
    const collection = await cache('collection', containerId, ctx.params.id, collectionBuilder);

    ctx.set('Content-Type', 'application/json; charset=utf-8');
    ctx.body = collection;
});

router.get('/:id/manifest', async ctx => {
    const containerId = await findContainerId(ctx.params.id);
    if (!containerId)
        throw new HttpError(404, `No manifest found with id ${ctx.params.id}`);

    const manifestBuilder = async () => await presentationBuilder.getManifest(ctx.params.id);
    const manifest = await cache('manifest', containerId, ctx.params.id, manifestBuilder);

    ctx.set('Content-Type', 'application/json; charset=utf-8');
    ctx.body = manifest;
});

async function findContainerId(id) {
    try {
        const result = await db.one('SELECT container_id FROM manifest WHERE id = $1', id);
        return result.container_id;
    }
    catch (e) {
        return null;
    }
}

module.exports = router;
