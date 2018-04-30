var express = require('express');
var router = express.Router();
let fs = require('fs');
const pool = require('../helpers/DB');
const mime = require('mime-types');

/* GET users listing. */
router.get('/:id', function(req, res) {

    let sql =
        "SELECT access_name, access_resolver " +
        "FROM manifest " +
        "WHERE id = $1;";
    pool.query(sql, [req.params.id], function (err, data) {
        if (err) {
            res.status(404);
            res.send({ error: 'Not found' });

            return;
        }

        if (data.rows.length === 0) {
            res.status(404);
            res.send({ error: 'Not found' });
            return;
        }


        let accessName = data.rows[0].access_name;
        let accessResolver = data.rows[0].access_resolver;

        let path = '../'+accessResolver;

        let file, stat;
        try {
            file = fs.createReadStream(path);
            stat = fs.statSync(path);
        } catch (e) {
            res.status(404);
            res.send({ error: 'File not found'});

            return;
        }

        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', mime.contentType(accessName));
        res.setHeader('Content-Disposition', 'inline; filename="' + accessName + '"');
        file.pipe(res);
    });









});

module.exports = router;
