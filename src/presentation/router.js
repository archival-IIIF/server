const Router = require('koa-router');
const HttpError = require('../lib/HttpError');
const logger = require('../lib/Logger');
const {cache} = require('../lib/Cache');
const {getItem} = require('../lib/Item');
const {AccessState, hasAccess} = require('../lib/Security');
const {isCollection, isManifest, getCollection, getManifest} = require('./builder/PresentationBuilder');

const V2_PROFILE = 'http://iiif.io/api/presentation/2/context.json';
const V3_PROFILE = 'http://iiif.io/api/presentation/3/context.json';

const router = new Router({prefix: '/iiif/presentation'});

router.get('/collection/:id', async ctx => {
    logger.info(`Received a request for a IIIF collection with id ${ctx.params.id}`);

    const item = await getItem(ctx.params.id);
    if (!isCollection(item))
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
    if (!isManifest(item))
        throw new HttpError(404, `No manifest found with id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, true);
    if (access.state === AccessState.CLOSED) {
        ctx.status = 401;
        setContent(ctx, await getManifest(item, access));
        return;
    }

    setContent(
        ctx,
        await cache('manifest', item.collection_id, item.id, async () => await getManifest(item, access))
    );

    logger.info(`Sending a IIIF manifest with id ${ctx.params.id}`);
});

function setContent(ctx, jsonDoc) {
    const profile = ((jsonDoc['@context'] === V2_PROFILE)
        || (Array.isArray(jsonDoc['@context']) && jsonDoc['@context'].includes(V2_PROFILE))) ? V2_PROFILE : V3_PROFILE;

    switch (ctx.accepts('application/ld+json', 'application/json')) {
        case 'application/json':
            ctx.body = jsonDoc;
            ctx.set('Content-Type', 'application/json');
            break;
        case 'application/ld+json':
        default:
            ctx.body = jsonDoc;
            ctx.set('Content-Type', `application/ld+json;profile="${profile}"`);
    }
}

module.exports = router;
