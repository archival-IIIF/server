let express = require('express');
let router = express.Router();


/* GET users listing. */
router.get('/', function (req, res, next) {

    res.send(req.session);

});

/* GET users listing. */
router.get('/login', function (req, res, next) {

    req.session.auth = true;
    req.session.save();
    res.send(
        '<label for="user"></label><input id="user" value="iish"/><br />' +
        '<label for="password"></label><input id="password" type="password" value="1234" /><br /><br />'+
        '<button onclick="javascript:window.close()">Log in</button>'
    );
    res.end();


});

/* GET users listing. */
router.get('/logout', function (req, res, next) {

    req.session.destroy();
    res.send('logged out');
    res.end();


});

module.exports = router;
