const Router = require('koa-router');
const mime = require('mime-types');
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');

const logger = require('../lib/Logger');
const config = require('../lib/Config');
const getPronomInfo = require('../lib/Pronom');
const HttpError = require('../lib/HttpError');
const {AccessState, hasAccess, hasAdminAccess} = require('../lib/Security');
const {getItem, getFullPath, getPronom, getAvailableType} = require('../lib/Item');

const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);

const router = new Router({prefix: '/file'});

router.use(async (ctx, next) => {
    ctx.set('Accept-Ranges', 'bytes');

    const rangeHeader = ctx.header.range;
    if (!rangeHeader)
        return await next();

    const [bytes, ranges] = rangeHeader.split('=');
    if (bytes !== 'bytes' || !ranges || ranges.includes(','))
        throw new HttpError(416, 'Range Not Satisfiable');

    let [start, end] = ranges.split('-');
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
        ctx.set('Content-Length', end - start + 1);
    }
});

router.get('/logo', async ctx => {
    try {
        ctx.set('Content-Type', mime.contentType(path.basename(config.logo)));
        ctx.body = await readFileAsync(config.logo);
    }
    catch (err) {
        throw new HttpError(404, 'No logo');
    }
});

router.get('/:id', getFile);
router.get('/:id/:type', getFile);

async function getFile(ctx) {
    logger.info(`Received a request for a file with id ${ctx.params.id}`);

    const item = await getItem(ctx.params.id);
    if (!item)
        throw new HttpError(404, `No file found with the id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, false);
    if (access.state !== AccessState.OPEN)
        throw new HttpError(401, 'Access denied');

    if (ctx.params.type && !['original', 'access'].includes(ctx.params.type))
        throw new HttpError(400, 'You can only request an original or an access copy!');

    const type = ctx.params.type || getAvailableType(item);
    const fullPath = getFullPath(item, type);

    if (!fullPath || (item.type === 'image' && !hasAdminAccess(ctx)))
        throw new HttpError(404, `No file found for id ${ctx.params.id} and type ${type}`);

    const pronom = getPronom(item, type);
    const name = path.basename(fullPath);
    const pronomInfo = getPronomInfo(pronom);
    const stat = await statAsync(fullPath);

    if (item.resolution)
        ctx.set('Content-Resolution', item.resolution);

    ctx.set('Content-Length', stat.size);
    ctx.set('Content-Type', (pronomInfo && pronomInfo.mime) ? pronomInfo.mime : mime.contentType(name));
    ctx.set('Content-Disposition', `inline; filename="${name}"`);

    const options = {};
    if (ctx.state.start && ctx.state.end &&
        (ctx.state.start < stat.size) && ((ctx.state.end < stat.size) || !isFinite(ctx.state.end))) {
        options.start = ctx.state.start;
        options.end = ctx.state.end;
    }
    ctx.body = fs.createReadStream(fullPath, options);

    logger.info(`Sending a file with id ${ctx.params.id}`);
}

module.exports = router;
