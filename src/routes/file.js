const Router = require('koa-router');
const mime = require('mime-types');
const pool = require('../helpers/DB');
const config = require('../helpers/Config');
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');

const statAsync = promisify(fs.stat);

const router = new Router({prefix: '/file'});

router.get('/:id', async ctx => {
    try {
        const sql =`
            SELECT access_name, access_resolver, original_name, original_resolver
            FROM manifest 
            WHERE id = $1;`;

        const data = await pool.query(sql, [ctx.params.id]);
        if (data.rows.length === 0)
            throw 'Not found';

        let accessName = data.rows[0].access_name;
        let accessResolver = data.rows[0].access_resolver;
        if (!accessResolver) {
            accessName = data.rows[0].original_name;
            accessResolver = data.rows[0].original_resolver;
        }
        if (accessResolver) {
            accessResolver = path.join(config.dataPath, accessResolver);
        }

        const file = fs.createReadStream(accessResolver);
        const stat = await statAsync(accessResolver);

        ctx.set('Content-Length', stat.size);
        ctx.set('Content-Type', mime.contentType(accessName));
        ctx.set('Content-Disposition', `inline; filename="${accessName}"`);

        ctx.body = file;
    }
    catch (err) {
        ctx.throw(404, err.message);
    }
});

module.exports = router;
