const Router = require('koa-router');
const mime = require('mime-types');
const path = require('path');
const file = require('../lib/File');
const config = require('../lib/Config');
const fs = require('fs');
const {promisify} = require('util');

const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);

const router = new Router({prefix: '/file'});

router.get('/logo', async ctx => {
    try {
        ctx.set('Content-Type', mime.contentType(path.basename(config.logo)));
        ctx.body = await readFileAsync(config.logo);
    }
    catch (err) {
        ctx.throw(404, err.message);
    }
});

router.get('/:id', async ctx => {
    const fullPath = await file.getFullPath(ctx.params.id);
    const name = path.basename(fullPath);
    const stat = await statAsync(fullPath);
    const stream = fs.createReadStream(fullPath);

    ctx.set('Content-Length', stat.size);
    ctx.set('Content-Type', mime.contentType(name));
    ctx.set('Content-Disposition', `inline; filename="${name}"`);

    ctx.body = stream;
});

module.exports = router;
