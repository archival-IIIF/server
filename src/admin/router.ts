import {existsSync} from 'fs';
import * as Router from '@koa/router';

import HttpError from '../lib/HttpError';
import {runTask} from '../lib/Task';
import {workerStatus} from '../lib/Worker';
import {hasAdminAccess, getIpAddress} from '../lib/Security';
import {IndexParams, MetadataParams} from '../lib/Service';

import registerToken from './register_token';
import indexCollection from './api_index';

const router = new Router({prefix: '/admin'});

router.use(async (ctx, next) => {
    if (!hasAdminAccess(ctx))
        throw new HttpError(403, 'Access denied');
    await next();
});

router.get('/worker_status', async ctx => {
    ctx.body = await workerStatus();
});

router.get('/headers', async ctx => {
    ctx.body = {
        ips: ctx.ips,
        headers: ctx.headers,
        ip: getIpAddress(ctx),
    };
});

router.post('/index_api', async ctx => {
    await indexCollection(ctx.request.body);
    ctx.body = 'Successfully indexed the collection!';
});

router.post('/index', async ctx => {
    if (!ctx.request.body.path)
        throw new HttpError(400, 'Please provide a path');

    const path = ctx.request.body.path;
    if (!existsSync(path))
        throw new HttpError(400, `The provided path "${path}" does not seem to exist`);

    runTask<IndexParams>('index', {collectionPath: path});
    ctx.body = 'Collection is sent to the queue for indexing';
});

router.post('/update_metadata', async ctx => {
    if (!ctx.request.body.id)
        throw new HttpError(400, 'Please provide an OAI identifier of the record to update');

    runTask<MetadataParams>('metadata', {oaiIdentifier: ctx.request.body.id});
    ctx.body = 'OAI identifier is sent to the queue for metadata update';
});

router.post('/register_token', async ctx => {
    ctx.body = await registerToken(
        ctx.request.body.token, ctx.request.body.collection, ctx.request.body.from, ctx.request.body.to);
});

export default router;
