const Router = require('koa-router');
const mime = require('mime-types');
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');

const config = require('../lib/Config');
const HttpError = require('../lib/HttpError');
const {hasAccess} = require('../lib/Security');
const {getItem, getFullPath} = require('../lib/Item');

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

router.get('/:id', async ctx => {
    const item = await getItem(ctx.params.id);
    if (await hasAccess(ctx, item)) {
        const fullPath = getFullPath(item);
        const name = path.basename(fullPath);
        const stream = fs.createReadStream(fullPath);

        ctx.set('Content-Length', item.size);
        ctx.set('Content-Type', mime.contentType(name));
        ctx.set('Content-Disposition', `inline; filename="${name}"`);

        ctx.body = stream;
    }
    else {
        throw new HttpError(401, 'Access denied');
    }
});

module.exports = router;
