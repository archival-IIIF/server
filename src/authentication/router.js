const {createReadStream} = require('fs');
const path = require('path');
const moment = require('moment');
const Router = require('koa-router');
const security = require('../lib/Security');

const prefix = '/iiif/auth';
const router = new Router({prefix});

router.get('/login', ctx => {
    ctx.type = 'text/html';
    ctx.body = createReadStream(path.join(__dirname, 'token-login.html'));
});

router.post('/login', async ctx => {
    const token = ctx.request.body.token;

    const tokens = await security.checkTokenDb([token]);
    if (tokens.length > 0) {
        let accessId = await security.getAccessIdFromRequest(ctx, false);
        accessId = await security.setAccessIdForIdentity(token, accessId);
        ctx.cookies.set('access', accessId, {
            signed: true,
            maxAge: 3600000,
            expires: moment().add(1, 'd').toDate(),
            overwrite: true
        });

        ctx.type = 'text/html';
        ctx.body = createReadStream(path.join(__dirname, 'close-window.html'));
    }
    else {
        ctx.redirect(`${prefix}/login`);
    }
});

router.get('/token', async ctx => {
    const message = {};

    const accessId = await security.getAccessIdFromRequest(ctx, false);
    if (accessId) {
        message.accessToken = await security.setAccessTokenForAccessId(accessId);
        message.expiresIn = 3600;
    }
    else {
        message.error = 'missingCredentials';
        message.description = 'No access cookie found!';
    }

    if (ctx.query.messageId && ctx.query.origin) {
        message.messageId = ctx.query.messageId;

        ctx.body = `<html>
            <body>
            <script>    
                window.parent.postMessage(${JSON.stringify(message)}, "${ctx.query.origin}");    
            </script>
            </body>
            </html>`;
    }
    else {
        ctx.body = message;
    }
});

router.get('/logout', async ctx => {
    await security.removeAccessIdFromRequest(ctx);

    ctx.type = 'text/html';
    ctx.body = createReadStream(path.join(__dirname, 'logout.html'));
});


module.exports = router;
