const Router = require('koa-router');
const config = require('../lib/Config');
const {runTask} = require('../lib/Task');
const HttpError = require('../lib/HttpError');
const registerToken = require('./register_token');
const importCollection = require('./api_import');

const router = new Router({prefix: '/admin'});

router.use((ctx, next) => {
    if (!ctx.request.body.access_token || (ctx.request.body.access_token.toLowerCase() !== config.accessToken))
        throw new HttpError(403, 'Access denied');

    next();
});

router.post('/import_api', async ctx => {
    await importCollection(ctx.request.body);
    ctx.body = 'Successfully imported collection!';
});

router.post('/import', async ctx => {
    if (!ctx.request.body.path)
        throw new HttpError(400, 'Please provide a path');

    runTask('import', {path: ctx.request.body.path});
    ctx.body = 'Import is sent to the queue';
});

router.post('/register_token', async ctx => {
    ctx.body = await registerToken(
        ctx.request.body.token, ctx.request.body.container, ctx.request.body.from, ctx.request.body.to);
});

module.exports = router;
