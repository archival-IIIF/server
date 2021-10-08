import * as path from 'path';

import Router from '@koa/router';
import send from 'koa-send';
import {DefaultState} from 'koa';

import HttpError from '../lib/HttpError';
import {ExtendedContext} from '../lib/Koa';
import {fileIconsPath} from '../lib/FileIcon';

export const router = new Router<DefaultState, ExtendedContext>();

router.use(async (ctx, next) => {
    try {
        await next();
    }
    catch (e) {
        throw new HttpError(404, 'Not found');
    }
});

router.get('/', async ctx => {
    await send(ctx, '/src/static/iiif-explorer.html');
});

router.get('/iiif-explorer:path(.*)?', async ctx => {
    const root = path.join(__dirname, '../../node_modules/iiif-explorer/dist/iiif-explorer/');
    await send(ctx, ctx.params.path, {root});
});

router.get('/file-icon:path(.*)', async ctx => {
    await send(ctx, ctx.params.path, {root: fileIconsPath});
});
