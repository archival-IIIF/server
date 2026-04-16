import Koa from 'koa';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import compress from 'koa-compress';

import config from './lib/Config.ts';
import logger from './lib/Logger.ts';
import {extendContext} from './lib/Koa.ts';

import type {ExtendedContext} from './lib/Koa.ts';

import {router as iiifImageRouter} from './image/router.ts';
import {router as iiifPresentationRouter} from './presentation/router.ts';
import {router as iiifSearchRouter} from './search/router.ts';
import {router as iiifAuthRouter} from './authentication/router.ts';
import {router as fileRouter} from './file/router.ts';
import {router as pdfRouter} from './pdf/router.ts';
import {router as textRouter} from './text/router.ts';
import {router as helperRouter} from './helper/router.ts';
import {router as adminRouter} from './admin/router.ts';
import {router as staticRouter} from './static/router.ts';

const app = new Koa<Koa.DefaultState, ExtendedContext>();

app.use(async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (ctx.method === 'OPTIONS')
        ctx.status = 204;
    else
        await next();
});

app.use(async (ctx, next) => {
    extendContext(ctx);
    await next();
});

app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err: any) {
        ctx.status = err.status || 500;
        ctx.body = (err.status && err.status < 500) ? err.message : 'Internal Server Error';

        if (!err.status || err.status >= 500)
            ctx.app.emit('error', err, ctx);
    }
});

app.on('error', (err, ctx) => {
    if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
    logger.error(`${err.status || 500} - ${ctx.method} - ${ctx.originalUrl} - ${err.message}`, {err});
});

if (config.env !== 'production') {
    const {default: morgan} = await import('koa-morgan');
    // @ts-ignore
    app.use(morgan('short', {'stream': logger.stream}));
}

app.use(compress());
app.use(json({pretty: false, param: 'pretty'}));
app.use(bodyParser());

app.use(iiifImageRouter.routes());
app.use(iiifPresentationRouter.routes());
app.use(iiifSearchRouter.routes());
app.use(iiifAuthRouter.routes());

app.use(fileRouter.routes());
app.use(pdfRouter.routes());
app.use(textRouter.routes());
app.use(helperRouter.routes());
app.use(adminRouter.routes());
app.use(staticRouter.routes());

app.proxy = true;
app.keys = [config.secret];

app.listen(config.port);

logger.info(`Started the web service on ${config.baseUrl} 🚀`);
