const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mkdirp = require('mkdirp-promise');
const {promisify} = require('util');
const config = require('../lib/Config');
const pool = require('../lib/DB');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const existsAsync = file => new Promise(resolve => fs.access(file, fs.F_OK, e => resolve(!e)));
const statAsync = promisify(fs.stat);

async function getInfo(id) {
    const result = {
        info: null,
        status: 200
    };

    const cacheDirName = path.join(config.cachePath, normalize(`cache/iiif/info/${id}`));
    const cachePath = path.join(cacheDirName, 'info.json');

    if (!await existsAsync(cachePath)) {
        const sql = `
            SELECT access_resolver, original_resolver
            FROM manifest 
            WHERE id = $1;`;

        const data = await pool.query(sql, [id]);
        if (data.rows.length === 0)
            throw 'Not found';

        let accessResolver = data.rows[0].access_resolver;
        if (!accessResolver)
            accessResolver = data.rows[0].original_resolver;
        if (accessResolver)
            accessResolver = path.join(config.dataPath, accessResolver);

        if (!await existsAsync(cacheDirName))
            await mkdirp(cacheDirName);

        const info = {
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
            "@id": `${config.baseUrl}/iiif/image/${id}`,
        };

        await writeFileAsync(cachePath, JSON.stringify(info));
    }

    result.info = JSON.parse(await readFileAsync(cachePath));

    return result;
}

async function getImage(id, region, size, rotation, quality, format) {
    const result = {
        image: null,
        status: 200,
        contentType: 'image/jpeg',
        contentLength: null
    };

    const cacheDirName = path.join(config.cachePath, normalize(`cache/iiif/image/${id}/${region}/${size}/${rotation}`));
    const cachePath = path.join(cacheDirName, 'default.jpg');

    if (!await existsAsync(cachePath)) {
        const sql = `
            SELECT access_resolver, original_resolver
            FROM manifest 
            WHERE id = $1;`;

        const data = await pool.query(sql, [id]);
        if (data.rows.length === 0)
            throw 'Not found';

        let accessResolver = data.rows[0].access_resolver;
        if (!accessResolver)
            accessResolver = data.rows[0].original_resolver;
        if (accessResolver)
            accessResolver = path.join(config.dataPath, accessResolver);

        if (!await existsAsync(cacheDirName))
            await mkdirp(cacheDirName);

        const buildImage = sharp(accessResolver);

        if (size.includes(',')) {
            let sizeArray = size.split(',');
            let width = sizeArray[0];
            let height = sizeArray[1];
            if (isNormalInteger(width) && isNormalInteger(height)) {
                buildImage.resize(parseInt(width), parseInt(height));
            }
        }

        region = getRegion(region);
        if (region)
            buildImage.extract(region);

        if (isNormalInteger(rotation)) {
            rotation = parseInt(rotation);
            if (rotation === 0 || rotation === 90 || rotation === 180 || rotation === 270 || rotation === 360)
                buildImage.rotate(rotation);
        }

        await buildImage.toFile(cachePath);
    }

    const stat = await statAsync(cachePath);
    result.contentLength = stat.size;
    result.image = await readFileAsync(cachePath);

    return result;
}

function getRegion(region) {
    const output = {};
    if (region.includes(',')) {
        const regionArray = region.split(',');

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

function isNormalInteger(str) {
    const n = Math.floor(Number(str));
    return n !== Infinity && String(n) === str && n >= 0;
}

function normalize(s) {
    return s.replace(/ /gi, '_').toLowerCase();
}

module.exports = {getInfo, getImage};
