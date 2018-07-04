const Router = require('koa-router');

const config = require('../lib/Config');
const external = require('./external');
const internal = require('./internal');

const prefix = '/iiif/image';
const router = new Router({prefix});

router.get('/:id', ctx => {
    ctx.status = 303;
    ctx.redirect(`${prefix}/${ctx.params.id}/info.json`);
});

router.get('/:id/info.json', async ctx => {
    try {
        const imageInfo = (config.imageServerUrl)
            ? await external.getInfo(ctx.params.id)
            : await internal.getInfo(ctx.params.id);

        ctx.body = imageInfo.info;
        ctx.status = imageInfo.status;
    }
    catch (err) {
        ctx.throw(404, err.message);
    }
});

router.get('/:id/:region/:size/:rotation/:quality.:format', async ctx => {
    try {
        const image = (config.imageServerUrl)
            ? await external.getImage(ctx.params.id, ctx.params.region, ctx.params.size,
                ctx.params.rotation, ctx.params.quality, ctx.params.format)
            : await internal.getImage(ctx.params.id, ctx.params.region,
                ctx.params.size, ctx.params.rotation, ctx.params.quality, ctx.params.format);

        ctx.body = image.image;
        ctx.status = image.status;
        ctx.set('Content-Type', image.contentType);
        ctx.set('Content-Length', image.contentLength);
    }
    catch (err) {
        ctx.throw(404, err.message);
    }
});

module.exports = router;
