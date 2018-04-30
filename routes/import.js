const express = require('express');
const router = express.Router();
const pool = require('../helpers/DB');
const fs = require('fs');

/* GET users listing. */
router.put('/', async function (req, res) {


    if (req.headers['x-access-token'] !== "12345") {
        res.status(401);
        res.send({error: 'Forbidden wrong token'});
        return;
    }

    let root = req.body;

    if (!root.hasOwnProperty("id")) {
        res.status(400);
        res.send({error: 'ID missing'});
        return
    }

    if (!root.hasOwnProperty("items")) {
        res.status(400);
        res.send({error: 'Items missing'});
        return
    }

    let countSql = "SELECT id FROM manifest WHERE container_id = $1";
    let result;
    try {
        result = await pool.query(countSql, [root.id]);
    } catch (e) {
        res.status(400);
        res.send({error: e.message});
        return;
    }

    let status = 200;

    if (result === undefined) {
        res.status(400);
        res.send({error: 'error'});
        return
    }

    if (result.rowCount > 0) {
        status = 201;
        let deleteSql = "DELETE FROM manifest WHERE container_id = $1;";
        await pool.query(deleteSql, [root.id]);

        for(let i in result.rows) {
            fs.unlink("./cache/manifest/" + result.rows[i].id + ".json", function () {});
        }
    }

    let fields = [
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

    let values = [];
    let errors = [];
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

    for (let l in root.items) {

        let item = root.items[l];
        let p = [];
        p.push(item.id);
        if (item.hasOwnProperty("parent")) {
            p.push(item.parent);
        } else {
            p.push(root.id);
        }
        p.push(root.id);
        p.push(item.metadata);
        p.push(item.type);

        if (item.type === "folder") {

            if (!item.hasOwnProperty("name")) {
                errors.push({
                    id: item.id,
                    message: "Name missing"
                });
                continue;
            }

            p.push(item.name);
            p.push(null);
            p.push(null);
            p.push(null);
            p.push(null);
            p.push(null);
        } else {

            p.push(item.original.name);
            p.push(item.original.resolver);
            p.push(item.original.pronom);

            if (item.access !== undefined && item.access.name !== undefined) {
                p.push(item.access.name);
            } else {
                p.push(null);
            }

            if (item.access !== undefined && item.access.resolver !== undefined) {
                p.push(item.access.resolver);
            } else {
                p.push(null);
            }

            if (item.access !== undefined && item.access.pronom !== undefined) {
                p.push(item.access.pronom);
            } else {
                p.push(null);
            }

        }

        parameters = parameters.concat(p);


        values.push(getValue(k, p.length));
        k += p.length;
    }



    let insertSql =
        "INSERT INTO manifest ("+ fields.join(", ") + ") " +
        "VALUES  " + values.join(", ");

    await pool.query(
        insertSql,
        parameters
    );

    res.status(status);
    res.send("done");

});

function getValue(start, length) {
    let value = [];

    for (let i = start; i < start + length; i++) {
        value.push("$"+i.toString());
    }

    return "(" + value.join(", ") + ")";
}

module.exports = router;

