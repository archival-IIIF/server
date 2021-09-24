import {existsSync} from 'fs';
import Router from '@koa/router';

import HttpError from '../lib/HttpError';
import {runTask} from '../lib/Task';
import {workerStatus} from '../lib/Worker';
import {hasAdminAccess, getIpAddress} from '../lib/Security';
import {IndexParams, MetadataParams} from '../lib/Service';

import registerToken from './register_token';
import indexCollection from './api_index';
import {Item} from '../lib/ItemInterfaces';

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
    await indexCollection(ctx.request.body as object);
    ctx.body = 'Successfully indexed the collection!';
});

router.post('/index', async ctx => {
    const body = ctx.request.body as Record<'path', string | undefined>;
    if (!body.path)
        throw new HttpError(400, 'Please provide a path');

    if (!existsSync(body.path))
        throw new HttpError(400, `The provided path "${body.path}" does not seem to exist`);

    runTask<IndexParams>('index', {collectionPath: body.path});
    ctx.body = 'Collection is sent to the queue for indexing';
});

router.post('/update_metadata', async ctx => {
    const body = ctx.request.body as Record<'oai_identifier' | 'root_id' | 'collection_id', string | undefined>;
    if (!body.oai_identifier && !body.root_id && !body.collection_id)
        throw new HttpError(400,
            'Please provide an OAI identifier or a root/collection id of the record(s) to update');

    runTask<MetadataParams>('metadata', {
        oaiIdentifier: body.oai_identifier,
        rootId: body.root_id,
        collectionId: body.collection_id
    });

    ctx.body = 'OAI identifier and/or root/collection id is sent to the queue for metadata update';
});

router.post('/register_token', async ctx => {
    const body = ctx.request.body as Record<'token' | 'collection' | 'from' | 'to', string | undefined>;
    ctx.body = await registerToken(body.token, body.collection, body.from, body.to);
});

export default router;
