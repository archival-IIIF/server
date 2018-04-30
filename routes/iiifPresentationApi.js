var express = require('express');
var router = express.Router();
let fs = require('fs');
const pool = require('../helpers/DB');
const manifestBuilder = require('../helpers/ManifestBuilder');

/* GET users listing. */
router.get('/:id', show);
router.get('/:id/manifest.json', show);

function show(req, res) {

    let path = './cache/manifest/'+req.params.id+'.json';
    console.log(path);

    fs.readFile(path, 'utf8', function (err, fileData) {
        if(err) {

            let sql =
                "SELECT a.id as id, a.type as type, a.parent_id, " +
                "a.original_name as original_name, a.original_pronom as original_pronom, " +
                "a.access_resolver as access_resolver, a.access_pronom as access_pronom, " +
                "b.id as child_id , b.type as child_type, " +
                "b.original_name as child_original_name, b.original_pronom as child_original_pronom, " +
                "b.access_resolver as child_access_resolver " +
                "FROM manifest as a " +
                "LEFT JOIN manifest as b ON a.id = b.parent_id " +
                "WHERE a.id = $1;";

            pool.query(sql, [req.params.id], function (err, data) {
                if (err) {
                    res.status(404);
                    res.send({ error: 'Not found 1' });
                    return;
                }

                if (data.rows.length === 0) {
                    res.status(404);
                    res.send({ error: 'Not found 2' });
                    return;
                }

                let manifest = new manifestBuilder();
                let output = manifest.get(data.rows);

                res.send(output);

                /*fs.writeFile(path, JSON.stringify(output), function () {
                    console.log("done")
                });*/

            });

        } else {

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.send(fileData);

        }
    });


}

module.exports = router;
