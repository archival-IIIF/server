const Router = require('koa-router');

const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const mkdirp = require('mkdirp-promise');

const pool = require('../helpers/DB');
const config = require('../helpers/Config');
const ManifestBuilder = require('../helpers/ManifestBuilder');

const readFileAsync = promisify(fs.readFile);
const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);

const router = new Router({prefix: '/iiif/presentation'});

router.get('/:id/manifest', async ctx => {
    let manifest = null;
    const manifestPath = path.join(config.cachePath, 'manifests', ctx.params.id + '.json');

    try {
        manifest = JSON.parse(await readFileAsync(manifestPath, {encoding: 'utf8'}));
    }
    catch (err) {
        try {
            manifest = await createManifest(ctx.params.id, manifestPath);
        }
        catch (err) {
            ctx.throw(404, err.message);
        }
    }
    finally {
        ctx.set('Content-Type', 'application/json; charset=utf-8');
        ctx.body = manifest;
    }
});

async function createManifest(id, manifestPath) {
    const sql = `
        SELECT a.id as id, a.type as type, a.parent_id, 
        a.original_name as original_name, a.original_pronom as original_pronom, 
        a.access_resolver as access_resolver, a.access_pronom as access_pronom, 
        b.id as child_id, b.type as child_type, 
        b.original_name as child_original_name, b.original_pronom as child_original_pronom, 
        b.access_resolver as child_access_resolver 
        FROM manifest as a 
        LEFT JOIN manifest as b ON a.id = b.parent_id 
        WHERE a.id = $1;`;

    const data = await pool.query(sql, [id]);
    if (data.rows.length === 0)
        throw 'Not found';

    const manifest = new ManifestBuilder();
    const output = manifest.get(data.rows);

    const dirName = path.dirname(manifestPath);
    if (await existsAsync(dirName)) {
        await writeFileAsync(manifestPath, JSON.stringify(output));
    }
    else {
        await mkdirp(dirName);
        await writeFileAsync(manifestPath, JSON.stringify(output));
    }

    return output;
}

module.exports = router;
