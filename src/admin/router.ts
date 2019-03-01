import * as Router from 'koa-router';

import {runTask} from '../lib/Task';
import HttpError from '../lib/HttpError';
import {hasAdminAccess} from '../lib/Security';
import {IndexParams} from '../lib/Service';

import registerToken from './register_token';
import indexCollection from './api_index';

const router = new Router({prefix: '/admin'});

router.use((ctx, next) => {
    if (!hasAdminAccess(ctx))
        throw new HttpError(403, 'Access denied');

    next();
});

router.post('/index_api', async ctx => {
    await indexCollection(ctx.request.body);
    ctx.body = 'Successfully indexed the collection!';
});

router.post('/index', async ctx => {
    if (!ctx.request.body.path)
        throw new HttpError(400, 'Please provide a path');

    runTask<IndexParams>('index', {collectionPath: ctx.request.body.path});
    ctx.body = 'Collection is sent to the queue for indexing';
});

router.post('/register_token', async ctx => {
    ctx.body = await registerToken(
        ctx.request.body.token, ctx.request.body.collection, ctx.request.body.from, ctx.request.body.to);
});

export default router;
