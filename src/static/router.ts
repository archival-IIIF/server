import * as path from 'path';
import {createReadStream} from 'fs';

import Router from '@koa/router';
import send from 'koa-send';

import config from '../lib/Config';
import HttpError from '../lib/HttpError';
import {fileIconsPath} from '../lib/FileIcon';

const router = new Router();

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

if (config.archivalViewerPath) {
    router.get('/archivalviewer:path(.*)?', async ctx => {
        if (!ctx.params.path)
            return ctx.redirect(`/archivalviewer/${ctx.search}`);

        await send(ctx, ctx.params.path, {root: config.archivalViewerPath, index: 'index.html'});
    });
}

if (config.universalViewerPath) {
    router.get('/universalviewer:path(.*)?', async ctx => {
        if (!ctx.params.path)
            return ctx.redirect(`/universalviewer/`);

        if (ctx.params.path === '/')
            return await send(ctx, '/src/static/universalviewer.html');

        if (ctx.params.path === '/universalviewer.css')
            return await send(ctx, '/src/static/universalviewer.css');

        if (ctx.params.path === '/universalviewer.js')
            return await send(ctx, '/src/static/universalviewer.js');

        if (ctx.params.path === '/uv-config.json' && config.universalViewerConfigPath) {
            ctx.body = createReadStream(config.universalViewerConfigPath);
            return;
        }

        await send(ctx, ctx.params.path, {root: config.universalViewerPath});
    });
}

export default router;
