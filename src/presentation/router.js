const Router = require('koa-router');
const {db} = require('../lib/DB');
const {cache} = require('../lib/Cache');
const HttpError = require('../lib/HttpError');
const presentationBuilder = require('./PresentationBuilder');

const router = new Router({prefix: '/iiif/presentation'});

router.get('/collection/:id', async ctx => {
    const containerId = await validateRequest(ctx);
    const collectionBuilder = async () => await presentationBuilder.getCollection(ctx.params.id);
    ctx.body = await cache('collection', containerId, ctx.params.id, collectionBuilder);
});

router.get('/:id/manifest', async ctx => {
    const containerId = await validateRequest(ctx);
    const manifestBuilder = async () => await presentationBuilder.getManifest(ctx.params.id);
    ctx.body = await cache('manifest', containerId, ctx.params.id, manifestBuilder);
});

async function validateRequest(ctx) {
    const containerId = await findContainerId(ctx.params.id);
    if (!containerId)
        throw new HttpError(404, `No collection found with id ${ctx.params.id}`);

    return containerId;
}

async function findContainerId(id) {
    try {
        const result = await db.one('SELECT container_id FROM items WHERE id = $1', id);
        return result.container_id;
    }
    catch (e) {
        return null;
    }
}

module.exports = router;
