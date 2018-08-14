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

    if (await security.checkTokenDb([token])) {
        let accessId = await security.getAccessIdFromRequest(ctx);
        accessId = await security.setAccessIdForIdentity(token, accessId);
        ctx.cookies.set('access', accessId, {
            signed: true,
            maxAge: 3600000,
            expires: moment().add(1, 'd').toDate(),
            //secure: true,
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

    const accessId = await security.getAccessIdFromRequest(ctx);
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

module.exports = router;
