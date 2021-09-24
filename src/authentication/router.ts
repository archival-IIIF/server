import {createReadStream} from 'fs';
import * as path from 'path';
import Router from '@koa/router';

import config from '../lib/Config';
import {
    checkTokenDb,
    getAccessIdFromRequest,
    removeAccessIdFromRequest,
    setAccessIdForIdentity,
    setAccessTokenForAccessId
} from '../lib/Security';

type TokenBody = Record<'token', string | undefined>;

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
    const token = (ctx.request.body as TokenBody).token;
    if (token) {
        const tokens = await checkTokenDb([token]);
        if (tokens.length > 0) {
            let accessId = await getAccessIdFromRequest(ctx, false);
            accessId = await setAccessIdForIdentity(token, accessId);
            ctx.cookies.set('access', accessId, {signed: true, overwrite: true});
        }
    }

    ctx.type = 'text/html';
    ctx.body = createReadStream(path.join(__dirname, 'close-window.html'));
});

router.get('/token', async ctx => {
    const accessId = await getAccessIdFromRequest(ctx, false);
    const token = (accessId) ? await setAccessTokenForAccessId(accessId) : null;

    const message: AccessTokenMessage | ErrorMessage = (token)
        ? {accessToken: token, expiresIn: config.accessTtl}
        : {error: 'missingCredentials', description: 'No access cookie found!'};

    if (ctx.query.messageId && ctx.query.origin) {
        message.messageId = Array.isArray(ctx.query.messageId) ? ctx.query.messageId[0] : ctx.query.messageId;

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
    await removeAccessIdFromRequest(ctx);

    ctx.type = 'text/html';
    ctx.body = createReadStream(path.join(__dirname, 'logout.html'));
});

export default router;
