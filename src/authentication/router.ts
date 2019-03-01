import {createReadStream} from 'fs';
import * as path from 'path';
import * as moment from 'moment';
import * as Router from 'koa-router';
import * as security from '../lib/Security';

type Message = { messageId?: string };
type AccessTokenMessage = Message & { accessToken: string, expiresIn: number };
type ErrorMessage = Message & { error: string, description: string };

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
            maxAge: 86400000,
            expires: moment().add(1, 'd').toDate(),
            overwrite: true
        });
    }

    ctx.type = 'text/html';
    ctx.body = createReadStream(path.join(__dirname, 'close-window.html'));
});

router.get('/token', async ctx => {
    const accessId = await security.getAccessIdFromRequest(ctx, false);
    const token = (accessId) ? await security.setAccessTokenForAccessId(accessId) : null;

    const message: AccessTokenMessage | ErrorMessage = (token)
        ? {accessToken: token, expiresIn: 3600}
        : {error: 'missingCredentials', description: 'No access cookie found!'};

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
    else
        ctx.body = message;
});

router.get('/logout', async ctx => {
    await security.removeAccessIdFromRequest(ctx);

    ctx.type = 'text/html';
    ctx.body = createReadStream(path.join(__dirname, 'logout.html'));
});

export default router;
