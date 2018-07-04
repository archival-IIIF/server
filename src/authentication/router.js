const Router = require('koa-router');

const router = new Router({prefix: '/iiif/auth'});

router.get('/token', ctx => {
    const message = {
        "messageId": ctx.query.messageId,
        "accessToken": "1234",
        "expiresIn": 3600
    };
    const origin = ctx.query.origin;

    ctx.body = '<script>window.parent.postMessage(' + JSON.stringify(message) + ', "' + origin + '");</script>';
});

module.exports = router;
