const Router = require('koa-router');
const mime = require('mime-types');
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');

const config = require('../lib/Config');
const getPronomInfo = require('../lib/Pronom');
const HttpError = require('../lib/HttpError');
const {AccessState, hasAccess, hasAdminAccess} = require('../lib/Security');
const {getItem, getFullPath, getPronom, getAvailableType} = require('../lib/Item');

const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);

const router = new Router({prefix: '/file'});

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

    ctx.body = fs.createReadStream(fullPath);
}

module.exports = router;
