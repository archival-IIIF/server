import {DefaultState} from 'koa';
import {createReadStream} from 'node:fs';
import Router from '@koa/router';

import config from '../lib/Config.js';
import {ExtendedContext} from '../lib/Koa.js';
import {
    checkTokenDb,
    getAccessIdFromRequest,
    removeAccessIdFromRequest,
    setAccessIdForIdentity,
    setAccessTokenForAccessId
} from '../lib/Security.js';

type TokenBody = Record<'token', string | undefined>;

type Message = { messageId?: string };
type AccessTokenMessage = Message & { accessToken: string, expiresIn: number };
type ErrorMessage = Message & { error: string, description: string };

const prefix = '/iiif/auth';
export const router = new Router<DefaultState, ExtendedContext>({prefix});

router.get('/login', ctx => {
    ctx.type = 'text/html';
    ctx.body = createReadStream('./src/authentication/token-login.html');
});

router.post('/login', async ctx => {
    const token = (ctx.request.body as TokenBody).token;
    if (token)
        await setCookieForToken(ctx, token);

    ctx.type = 'text/html';
    ctx.body = createReadStream('./src/authentication/close-window.html');
});

router.get('/cookie', async ctx => {
    const token = ctx.queryFirst('token');
    if (token)
        await setCookieForToken(ctx, token);

    ctx.redirect(ctx.queryFirst('redirect') || '/');
});

router.get('/token', async ctx => {
    const accessId = await getAccessIdFromRequest(ctx, false);
    const token = (accessId) ? await setAccessTokenForAccessId(accessId) : null;

    const message: AccessTokenMessage | ErrorMessage = (token)
        ? {accessToken: token, expiresIn: config.accessTtl}
        : {error: 'missingCredentials', description: 'No access cookie found!'};

    const messageId = ctx.queryFirst('messageId');
    const origin = ctx.queryFirst('origin');
    if (messageId && origin) {
        message.messageId = messageId;

        ctx.body = `<html>
            <body>
            <script>    
                window.parent.postMessage(${JSON.stringify(message)}, "${origin}");    
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
    ctx.body = createReadStream('./src/authentication/logout.html');
});

async function setCookieForToken(ctx: ExtendedContext, token: string): Promise<void> {
    const tokens = await checkTokenDb([token]);
    if (tokens.length > 0) {
        let accessId = await getAccessIdFromRequest(ctx, false);
        accessId = await setAccessIdForIdentity(token, accessId);
        ctx.cookies.set('access', accessId, {signed: true, overwrite: true});
    }
}
