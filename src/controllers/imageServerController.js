const fs = require('fs');
const sharp = require('sharp');
const mkdirp = require('mkdirp');
const config = require('../helpers/Config');
const pool = require('../helpers/DB');

exports.renderImage = function(req, res) {

    let path = 'ariel.jpg';
    let cacheDirName = 'cache/iiif/v2/image/' + req.params.id + '/' + req.params.region + '/' + req.params.size + '/' + req.params.rotation;
    cacheDirName = normalize(cacheDirName);

    let cachePath = cacheDirName + '/default.jpg';


    if (fs.existsSync(cachePath)){
        sendImage(res, cachePath);
        return;
    }

    let sql =
        "SELECT access_resolver " +
        "FROM manifest " +
        "WHERE id = $1;";

    pool.query(sql, [req.params.id], function (err, data) {
        if (err) {
            res.status(404);
            res.send({error: 'Not found 1'});
            return;
        }

        if (data.rows.length !== 1) {
            res.status(404);
            res.send({error: 'Not found 2'});
            return;
        }

        if (!fs.existsSync(cacheDirName)){
            mkdirp.sync(cacheDirName);
        }

        let buildImage = sharp('../' + data.rows[0].access_resolver);

        let size = req.params.size;
        if (size.includes(',')) {
            let sizeArray = size.split(',');
            let width = sizeArray[0];
            let height = sizeArray[1];
            if (isNormalInteger(width) && isNormalInteger(height)) {
                buildImage.resize(parseInt(width), parseInt(height));
            }
        }


        let region = getRegion(req.params.region);
        if (region !== false) {
            buildImage.extract(region);
        }

        let rotation = req.params.rotation;
        if (isNormalInteger(rotation)) {
            rotation = parseInt(rotation);
            if (rotation === 0 || rotation === 90 || rotation === 180 || rotation === 270 || rotation === 360) {
                buildImage.rotate(rotation);
            }
        }

        buildImage.toFile(cachePath, (err, info) => {
            sendImage(res, cachePath);
        });
    });
};

function getRegion(region) {

    let output = {};

    if (region.includes(',')) {
        let regionArray = region.split(',');

        if (regionArray.length !== 4) {
            return false;
        }

        if (!isNormalInteger(regionArray[0])) {
            return false;
        }
        output.left = parseInt(regionArray[0]);

        if (!isNormalInteger(regionArray[1])) {
            return false;
        }
        output.top = parseInt(regionArray[1]);

        if (!isNormalInteger(regionArray[2])) {
            return false;
        }
        output.width = parseInt(regionArray[2]);

        if (!isNormalInteger(regionArray[3])) {
            return false;
        }
        output.height = parseInt(regionArray[3]);

        return output;
    }

    return false;
}

function sendImage(res, cachePath) {
    let accessName = 'ariel.jpg';
    let file = fs.createReadStream(cachePath);
    let stat = fs.statSync(cachePath);

    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', "image/jpeg");
    res.setHeader('Content-Disposition', 'inline; filename="' + accessName + '"');
    file.pipe(res);
}

exports.renderInfo = function(req, res) {

    let path = 'ariel.jpg';
    let cacheDirName = 'cache/iiif/v2/info/' + req.params.id + '/' + req.params.region + '/' + req.params.size + '/' + req.params.rotation + '/' + req.params.quality + '.' + req.params.format;
    let cachePath = cacheDirName + '/' + path;


    if (fs.existsSync(cachePath)){
        //sendInfo(res, cachePath);
        //return;
    }

    if (!fs.existsSync(cacheDirName)){
        mkdirp.sync(cacheDirName);
    }

    let info = {
        "profile": [
            "http://iiif.io/api/image/2/level2.json",
            {
                "supports": [
                    "canonicalLinkHeader",
                    "profileLinkHeader",
                    "mirroring",
                    "rotationArbitrary",
                    "regionSquare",
                    "sizeAboveFull"
                ],
                "qualities": [
                    "default",
                    "color",
                    "gray",
                    "bitonal"
                ],
                "formats": [
                    "jpg",
                    "png",
                    "gif",
                    "webp"
                ]
            }
        ],
        "protocol": "http://iiif.io/api/image",
        "sizes": [],
        "width": 1840,
        "height": 1450,
        "@context": "http://iiif.io/api/image/2/context.json",
        "@id": config.baseUrl + "/iiif/image/" + req.params.id,
    };

    fs.writeFile(cachePath, JSON.stringify(info), function () {
        sendInfo(res, cachePath);
    });
};

function sendInfo(res, cachePath) {
    let file = fs.createReadStream(cachePath);
    let stat = fs.statSync(cachePath);

    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', "application/json");
    file.pipe(res);
}

function isNormalInteger(str) {
    var n = Math.floor(Number(str));
    return n !== Infinity && String(n) === str && n >= 0;
}

function normalize(s) {
    return s.replace(/ /gi, '_').toLowerCase();
}