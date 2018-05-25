let express = require('express');
let router = express.Router();
let http = require('http');
const config = require('../helpers/Config');
const imageServer = require('../controllers/imageServerController');
const externalImageServer = require('../controllers/externalImageServerController');

router.get('/:id', renderInfo);
router.get('/:id/info.json', renderInfo);

function renderInfo(req, res) {
    let imageServerUrl = config.imageServerUrl;
    if (imageServerUrl === false) {
        imageServer.renderInfo(req, res);
    } else {
        externalImageServer.renderInfo(req, res);
    }
}

router.get('/:id/:region/:size/:rotation/:quality.:format', renderImage);

function renderImage(req, res) {
    let imageServerUrl = config.imageServerUrl;
    if (imageServerUrl === false) {
        imageServer.renderImage(req, res);
    } else {
        externalImageServer.renderImage(req, res);
    }
}

module.exports = router;
