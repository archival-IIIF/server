const Router = require('koa-router');
const {cache} = require('../lib/Cache');
const {getItem} = require('../lib/Item');
const {AccessState, hasAccess} = require('../lib/Security');
const HttpError = require('../lib/HttpError');
const {getCollection, getManifest} = require('./PresentationBuilder');

const router = new Router({prefix: '/iiif/presentation'});

router.get('/collection/:id', async ctx => {
    const item = await getItem(ctx.params.id);
    if (!item || (item.type !== 'folder'))
        throw new HttpError(404, `No collection found with id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, true);
    if (access.state === AccessState.CLOSED) {
        ctx.status = 401;
        ctx.body = await getCollection(item, false);
        return;
    }

    ctx.body = await cache('collection', item.collection_id, item.id, async () => await getCollection(item, true));
});

router.get('/:id/manifest', async ctx => {
    const item = await getItem(ctx.params.id);
    if (!item || (item.type === 'folder'))
        throw new HttpError(404, `No manifest found with id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, true);
    if (access.state === AccessState.CLOSED) {
        ctx.status = 401;
        ctx.body = await getManifest(item, false);
        return;
    }

    ctx.body = await cache('manifest', item.collection_id, item.id, async () => await getManifest(item, true));
});

module.exports = router;
