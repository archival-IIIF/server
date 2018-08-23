const Router = require('koa-router');
const config = require('../lib/Config');
const {runTask} = require('../lib/Task');
const HttpError = require('../lib/HttpError');
const registerToken = require('./register_token');
const indexCollection = require('./api_index');

const router = new Router({prefix: '/admin'});

router.use((ctx, next) => {
    if (!ctx.request.body.access_token || (ctx.request.body.access_token.toLowerCase() !== config.accessToken))
        throw new HttpError(403, 'Access denied');

    next();
});

router.post('/index_api', async ctx => {
    await indexCollection(ctx.request.body);
    ctx.body = 'Successfully indexed the collection!';
});

router.post('/index', async ctx => {
    if (!ctx.request.body.path)
        throw new HttpError(400, 'Please provide a path');

    runTask('index', {dipPath: ctx.request.body.path});
    ctx.body = 'Collection is sent to the queue for indexing';
});

router.post('/register_token', async ctx => {
    ctx.body = await registerToken(
        ctx.request.body.token, ctx.request.body.collection, ctx.request.body.from, ctx.request.body.to);
});

module.exports = router;
