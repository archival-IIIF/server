import {existsSync} from 'node:fs';
import {DefaultState} from 'koa';
import Router from '@koa/router';

import HttpError from '../lib/HttpError.js';
import {runTask} from '../lib/Task.js';
import {workerStatus} from '../lib/Worker.js';
import {ExtendedContext} from '../lib/Koa.js';
import {hasAdminAccess, getIpAddress} from '../lib/Security.js';
import {EmptyParams, CollectionPathParams, MetadataParams, ProcessUpdateParams, ReindexParams} from '../lib/ServiceTypes.js';

import registerToken from './register_token.js';
import indexCollection from './api_index.js';

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/admin'});

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

    runTask<CollectionPathParams>('index', {collectionPath: body.path});
    ctx.body = 'Collection is sent to the queue for indexing';
});

router.post('/reindex', async ctx => {
    const body = ctx.request.body as { collection_id?: string[]; query?: string };
    if ((!body.collection_id || body.collection_id.length === 0) && !body.query)
        throw new HttpError(400,
            'Please provide the ids of the collections to reindex or the ElasticSearch query');

    runTask<ReindexParams>('reindex', {
        collectionIds: body.collection_id,
        query: body.query
    });

    ctx.body = 'Reindex triggered';
});

router.post('/update_metadata', async ctx => {
    const body = ctx.request.body as Record<'metadata_id' | 'root_id' | 'collection_id', string | undefined>;
    if (!body.metadata_id && !body.root_id && !body.collection_id)
        throw new HttpError(400,
            'Please provide an OAI identifier or a root/collection id of the record(s) to update');

    runTask<MetadataParams>('metadata', {
        metadataId: body.metadata_id,
        rootId: body.root_id,
        collectionId: body.collection_id
    });

    ctx.body = 'Metadata identifier and/or root/collection id is sent to the queue for metadata update';
});

router.post('/all_metadata_update', async ctx => {
    runTask<EmptyParams>('all-metadata-update', {});
    ctx.body = 'All metadata update triggered';
});

router.post('/process_update', async ctx => {
    const body = ctx.request.body as Record<'type' | 'query', string | undefined>;
    if (!body.type || !body.query)
        throw new HttpError(400,
            'Please provide the type of process to run and the ElasticSearch query for the items to update');

    runTask<ProcessUpdateParams>('process-update', {
        type: body.type,
        query: body.query
    });

    ctx.body = 'Process update triggered';
});

router.post('/register_token', async ctx => {
    const body = ctx.request.body as Record<'token' | 'id' | 'from' | 'to', string | undefined>;
    ctx.body = await registerToken(body.token, body.id, body.from, body.to);
});
