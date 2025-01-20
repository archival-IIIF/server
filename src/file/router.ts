import Router from '@koa/router';
import {Context, DefaultState} from 'koa';

import mime from 'mime-types';
import {basename} from 'node:path';
import {createReadStream, existsSync, Stats} from 'node:fs';
import {stat} from 'node:fs/promises';

import config from '../lib/Config.js';
import logger from '../lib/Logger.js';
import HttpError from '../lib/HttpError.js';
import derivatives from '../lib/Derivative.js';
import {ExtendedContext} from '../lib/Koa.js';
import fileFormatCollection from '../lib/Pronom.js';

import {AccessState, hasAccess, hasAdminAccess} from '../lib/Security.js';
import {getText, getFullPath as getFullTextPath} from '../lib/Text.js';
import {determineItem, getFullPath, getPronom, getAvailableType, hasType, getFullDerivativePath} from '../lib/Item.js';

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/file'});

router.use(async (ctx, next) => {
    ctx.set('Accept-Ranges', 'bytes');

    const rangeHeader = ctx.header.range;
    if (!rangeHeader)
        return next();

    const [bytes, ranges] = rangeHeader.split('=');
    if (bytes !== 'bytes' || !ranges || ranges.includes(','))
        throw new HttpError(416, 'Range Not Satisfiable');

    let [start, end]: (string | number)[] = ranges.split('-');
    start = Number(start);
    end = (end !== '') ? Number(end) : Infinity;

    if (isNaN(start) || isNaN(end))
        throw new HttpError(416, 'Range Not Satisfiable');

    logger.debug(`Received a range request from ${start} to ${end}`);

    ctx.state.start = start;
    ctx.state.end = end;

    await next();

    const length = ctx.length;
    if (!isNaN(length) && (start < length) && ((end < length) || !isFinite(end))) {
        end = isFinite(end) ? end : length - 1;

        ctx.status = 206;
        ctx.set('Content-Range', `bytes ${start}-${end}/${length}`);
        ctx.set('Content-Length', String(end - start + 1));
    }
});

router.get('/:id/:type(original|access)?', async ctx => {
    logger.info(`Received a request for a file with id ${ctx.params.id}`);

    const item = await determineItem(ctx.params.id);
    if (!item) {
        const text = await getText(ctx.params.id);
        if (!text)
            throw new HttpError(404, `No file found with the id ${ctx.params.id}`);

        const fullPath = getFullTextPath(text);
        const name = basename(fullPath);
        const fileStat = await stat(fullPath);

        ctx.set('Content-Type', text.source === 'alto' ? 'application/xml' : 'text/plain');
        ctx.set('Content-Length', String(fileStat.size));
        ctx.set('Content-Disposition', `inline; filename="${name}"`);
        setBody(ctx, fileStat, fullPath);

        logger.info(`Sending a text file with id ${ctx.params.id}`);
        return;
    }

    if (item.type === 'image' && !hasAdminAccess(ctx)) {
        ctx.redirect(`/iiif/image/${item.id}/full/max/0/default.jpg`);
        return;
    }

    const access = await hasAccess(ctx, item, false);
    if (access.state !== AccessState.OPEN)
        throw new HttpError(401, 'Access denied');

    if (ctx.params.type && !['original', 'access'].includes(ctx.params.type))
        throw new HttpError(400, 'You can only request an original or an access copy!');

    if (ctx.params.type && !hasType(item, ctx.params.type as 'original' | 'access'))
        throw new HttpError(400, `There is no ${ctx.params.type} copy for file with id ${ctx.params.id}`);

    const type = (ctx.params.type || getAvailableType(item)) as 'original' | 'access';
    const fullPath = getFullPath(item, type);
    if (!fullPath)
        throw new HttpError(404, `No file found for id ${ctx.params.id} and type ${type}`);

    const pronom = getPronom(item, type);
    const name = basename(fullPath);
    const pronomInfo = fileFormatCollection.get(pronom);
    const fileStat = await stat(fullPath);
    const contentType = (pronomInfo && pronomInfo.mime) ? pronomInfo.mime : mime.contentType(name);

    if (item.resolution)
        ctx.set('Content-Resolution', String(item.resolution));

    if (contentType)
        ctx.set('Content-Type', contentType);

    ctx.set('Content-Length', String(fileStat.size));
    ctx.set('Content-Disposition', `inline; filename="${name}"`);
    setBody(ctx, fileStat, fullPath);

    logger.info(`Sending a file with id ${ctx.params.id}`);
});

router.get('/:id/:derivative', async ctx => {
    logger.info(`Received a request for a file derivative with id ${ctx.params.id} of type ${ctx.params.derivative}`);

    if (!(ctx.params.derivative in derivatives))
        throw new HttpError(404, `No derivative of type ${ctx.params.derivative}`);

    const info = derivatives[ctx.params.derivative];
    const item = await determineItem(ctx.params.id);
    if (!item)
        throw new HttpError(404, `No file found with the id ${ctx.params.id}`);

    if (info.to === 'image' && !hasAdminAccess(ctx)) {
        const tier = info.imageTier ? config.imageTierSeparator + info.imageTier : '';
        ctx.redirect(`/iiif/image/${item.id}${tier}/full/max/0/default.jpg`);
        return;
    }

    const access = await hasAccess(ctx, item, false);
    if (access.state !== AccessState.OPEN)
        throw new HttpError(401, 'Access denied');

    const fullPath = getFullDerivativePath(item, info);
    if (!existsSync(fullPath))
        throw new HttpError(404, `No derivative found for id ${ctx.params.id} of type ${ctx.params.derivative}`);

    const fileStat = await stat(fullPath);

    ctx.set('Content-Type', info.contentType);
    ctx.set('Content-Length', String(fileStat.size));
    ctx.set('Content-Disposition', `inline; filename="${info.type}-${item.id}.${info.extension}"`);
    setBody(ctx, fileStat, fullPath);

    logger.info(`Sending a derivative with id ${ctx.params.id} of type ${ctx.params.derivative}`);
});

function setBody(ctx: Context, stat: Stats, fullPath: string) {
    const options: { start?: number, end?: number } = {};
    if (ctx.state.start && ctx.state.end &&
        (ctx.state.start < stat.size) && ((ctx.state.end < stat.size) || !isFinite(ctx.state.end))) {
        options.start = ctx.state.start;
        options.end = ctx.state.end;
    }
    ctx.body = createReadStream(fullPath, options);
}
