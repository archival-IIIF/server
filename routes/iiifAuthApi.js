var express = require('express');
var router = express.Router();


/* GET users listing. */
router.get('/token', function (req, res, next) {

    let message = {
            "messageId": req.query.messageId,
            "accessToken": "1234",
            "expiresIn": 3600
    };
    let origin = req.query.origin;

    res.send('<script>window.parent.postMessage('+JSON.stringify(message)+', "'+origin+'");</script>');

});

module.exports = router;
