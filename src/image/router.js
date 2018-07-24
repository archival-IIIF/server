const Router = require('koa-router');
const config = require('../lib/Config');
const imageServer = config.imageServerUrl ? require('./external') : require('./internal');

const prefix = '/iiif/image';
const router = new Router({prefix});

router.get('/:id', ctx => {
    ctx.status = 303;
    ctx.redirect(`${prefix}/${ctx.params.id}/info.json`);
});

router.get('/:id/info.json', async ctx => {
    const imageInfo = await imageServer.getInfo(ctx.params.id);

    ctx.body = imageInfo.info;
    ctx.status = imageInfo.status;
});

router.get('/:id/:region/:size/:rotation/:quality.:format', async ctx => {
    const image = await imageServer.getImage(ctx.params.id, ctx.params.region,
        ctx.params.size, ctx.params.rotation, ctx.params.quality, ctx.params.format);

    ctx.body = image.image;
    ctx.status = image.status;
    ctx.set('Content-Type', image.contentType);
    ctx.set('Content-Length', image.contentLength);
});

module.exports = router;
