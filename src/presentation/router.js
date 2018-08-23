const Router = require('koa-router');
const {cache} = require('../lib/Cache');
const {getItem} = require('../lib/Item');
const {AccessState, hasAccess} = require('../lib/Security');
const HttpError = require('../lib/HttpError');
const presentationBuilder = require('./PresentationBuilder');

const router = new Router({prefix: '/iiif/presentation'});

router.get('/collection/:id', async ctx => {
    const item = await getItem(ctx.params.id);
    if (!item || (item.type !== 'folder'))
    const {containerId, access} = await validateRequest(ctx);

    if (access.state !== AccessState.OPEN) {
        ctx.status = 401;
        ctx.body = await presentationBuilder.getCollection(ctx.params.id, false);
        return;
    }

    const collectionBuilder = async () => await presentationBuilder.getCollection(ctx.params.id, true);
    ctx.body = await cache('collection', containerId, ctx.params.id, collectionBuilder);
});

router.get('/:id/manifest', async ctx => {
    const {containerId, access} = await validateRequest(ctx);

    if (access.state !== AccessState.OPEN) {
        ctx.status = 401;
        ctx.body = await presentationBuilder.getManifest(ctx.params.id, false);
        return;
    }

    const manifestBuilder = async () => await presentationBuilder.getManifest(ctx.params.id, true);
    ctx.body = await cache('manifest', containerId, ctx.params.id, manifestBuilder);
});

async function validateRequest(ctx) {
    const containerId = await findContainerId(ctx.params.id);
    if (!containerId)
        throw new HttpError(404, `No collection found with id ${ctx.params.id}`);

    const collectionBuilder = async () => await presentationBuilder.getCollection(item);
    ctx.body = await cache('collection', item.collection_id, ctx.params.id, collectionBuilder);
});
    const item = await getItem(ctx.params.id);
    const access = await hasAccess(ctx, item, true);

router.get('/:id/manifest', async ctx => {
    const item = await getItem(ctx.params.id);
    if (!item || (item.type === 'folder'))
        throw new HttpError(404, `No manifest found with id ${ctx.params.id}`);
    return {containerId, access};
}

    const manifestBuilder = async () => await presentationBuilder.getManifest(item);
    ctx.body = await cache('manifest', item.collection_id, ctx.params.id, manifestBuilder);
});

module.exports = router;
