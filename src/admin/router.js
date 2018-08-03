const Router = require('koa-router');
const config = require('../lib/Config');
const {runTask} = require('../lib/Task');
const registerToken = require('./register_token');

const router = new Router({prefix: '/admin'});

router.use((ctx, next) => {
    if (!ctx.query.access_token || (ctx.query.access_token.toLowerCase() !== config.accessToken)) {
        ctx.status = 403;
        ctx.body = 'Access denied';
    }
    else {
        next();
    }
});

router.post('/import', async ctx => {
    if (!ctx.query.dip_path) {
        ctx.status = 400;
        ctx.body = 'Please provide a dip_path';
        return;
    }

    runTask('import', {dipPath: ctx.query.dip_path});
    ctx.body = 'Import is sent to the queue';
});

router.post('/register_token', async ctx => {
    ctx.body = await registerToken(ctx.query.token, ctx.query.container, ctx.query.from, ctx.query.to);
});

module.exports = router;
