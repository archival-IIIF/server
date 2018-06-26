const path = require('path');
const Router = require('koa-router');
const request = require('request-promise-native');
const config = require('../helpers/Config');

const router = new Router({prefix: '/iiif/image'});

router.get('/:id/info.json', async ctx => {
    try {
        const sql = `
            SELECT access_resolver, original_resolver
            FROM manifest 
            WHERE id = $1;`;

        const data = await pool.query(sql, [ctx.params.id]);
        if (data.rows.length === 0)
            throw 'Not found';

        let accessResolver = data.rows[0].access_resolver;
        if (!accessResolver) {
            accessResolver = data.rows[0].original_resolver;
        }
        if (accessResolver) {
            accessResolver = path.join(config.dataPath, accessResolver);
        }

        const url = `${config.imageServerUrl}/${accessResolver}/info.json`;
        const response = await request({uri: url, json: true, resolveWithFullResponse: true, simple: false});

        if (response.statusCode === 200) {
            const info = response.body;
            info['@id'] = `${config.baseUrl}/iiif/image/${ctx.params.id}`;
            ctx.body = info;
        }
        else {
            ctx.status = response.statusCode;
        }

        ctx.set('Link', response.headers['link']);
    }
    catch (err) {
        ctx.throw(404, err.message);
    }
});

router.get('/:id/:region/:size/:rotation/:quality.:format', async ctx => {
    const sql = `
            SELECT access_resolver, original_resolver
            FROM manifest 
            WHERE id = $1;`;

    const data = await pool.query(sql, [ctx.params.id]);
    if (data.rows.length === 0)
        throw 'Not found';

    let accessResolver = data.rows[0].access_resolver;
    if (!accessResolver) {
        accessResolver = data.rows[0].original_resolver;
    }
    if (accessResolver) {
        accessResolver = path.join(config.dataPath, accessResolver);
    }

    const url = `${config.imageServerUrl}/${accessResolver}/${ctx.params.region}/${ctx.params.size}/${ctx.params.rotation}/${ctx.params.quality}.${ctx.params.format}`;
    const response = await request({uri: url, encoding: null, resolveWithFullResponse: true, simple: false});

    if (response.statusCode === 200) {
        ctx.body = response.body;
        ctx.set('Content-Type', response.headers['content-type']);
        ctx.set('Content-Length', response.headers['content-length']);
    }
    else {
        ctx.status = response.statusCode;
    }

    ctx.set('Link', response.headers['link']);
});

module.exports = router;
