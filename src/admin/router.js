const Router = require('koa-router');
const config = require('../lib/Config');
const {runTask} = require('../lib/Task');

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

router.get('/import', async ctx => {
    if (!ctx.query.identifier || !ctx.query.dip_path) {
        ctx.status = 400;
        ctx.body = 'Please provide an identifier and a dip_path';
        return;
    }

    runTask('import', ctx.query.identifier, {dipPath: ctx.query.dip_path});
    ctx.body = 'Import is sent to the queue';
});

module.exports = router;

