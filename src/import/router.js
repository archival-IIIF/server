const Router = require('koa-router');
const pool = require('../lib/DB');
const HttpError = require('../lib/HttpError');
const fs = require('fs');
const {promisify} = require('util');

const unlinkAsync = promisify(fs.unlink);

const router = new Router({prefix: '/import'});

router.put('/', async ctx => {
    try {
        if (ctx.request.headers['x-access-token'] !== "12345") {
            ctx.throw(401, 'Forbidden wrong token');
            return;
        }

        const root = ctx.request.body;

        if (!root.hasOwnProperty("id"))
            throw 'ID missing';

        if (!root.hasOwnProperty("items"))
            throw 'Items missing';

        const countSql = "SELECT id FROM manifest WHERE container_id = $1";
        const result = await pool.query(countSql, [root.id]);

        let status = 200;
        if (result.rowCount > 0) {
            status = 201;

            const deleteSql = "DELETE FROM manifest WHERE container_id = $1;";
            await pool.query(deleteSql, [root.id]);

            result.rows.forEach(async row => await unlinkAsync("./cache/manifest/" + row.id + ".json"));
        }

        const fields = [
            "id",
            "parent_id",
            "container_id",
            "metadata",
            "type",
            "original_name",
            "original_resolver",
            "original_pronom",
            "access_name",
            "access_resolver",
            "access_pronom"
        ];

        const values = [];
        const errors = [];
        let parameters = [
            root.id,
            null,
            root.id,
            null,
            "folder",
            root.name,
            null,
            null,
            null,
            null,
            null
        ];

        let k = 1;
        values.push(getValue(k, parameters.length));
        k += parameters.length;

        root.items.forEach(item => {
            let p = [];

            p.push(item.id);
            p.push(item.parent ? item.parent : root.id);
            p.push(root.id);
            p.push(item.metadata);
            p.push(item.type);

            if (item.type === "folder") {
                if (!item.name) {
                    errors.push({
                        id: item.id,
                        message: "Name missing"
                    });
                }

                p.push(item.name);
                p.push(null);
                p.push(null);
                p.push(null);
                p.push(null);
                p.push(null);
            }
            else {
                p.push(item.original.name);
                p.push(item.original.resolver);
                p.push(item.original.pronom);
                p.push((item.access !== undefined && item.access.name !== undefined) ? item.access.name : null);
                p.push((item.access !== undefined && item.access.resolver !== undefined) ? item.access.resolver : null);
                p.push((item.access !== undefined && item.access.pronom !== undefined) ? item.access.pronom : null);
            }

            parameters = parameters.concat(p);

            values.push(getValue(k, p.length));
            k += p.length;
        });

        const insertSql = `INSERT INTO manifest (${fields.join(", ")}) VALUES ${values.join(", ")};`;
        await pool.query(insertSql, parameters);

        ctx.status = status;
        ctx.body = "Done"
    }
    catch (err) {
        throw new HttpError(400, err.message);
    }
});

function getValue(start, length) {
    const value = [];
    for (let i = start; i < start + length; i++)
        value.push("$" + i.toString());
    return `(${value.join(", ")})`;
}

module.exports = router;

