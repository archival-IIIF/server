exports.renderImage = function(req, res) {

    /*if (!req.session || req.session.auth !== true) {
        res.status(401);
        res.send({error: 'No auth'});
        return;
    }*/


    let url = 'http://localhost:8080/loris/' + req.params.id + '/' + req.params.region + '/' + req.params.size + '/' + req.params.rotation + '/' + req.params.quality + '.' + req.params.format + '/';
    let request = http.request(url, function (res2) {
        let data = '';
        res2.setEncoding('binary');
        res2.on('data', function (chunk) {
            data += chunk;
        });
        res2.on('end', function () {
            try {
                res.end(data, 'binary');
            } catch (err) {
                res.status(404);
                res.send({error: 'Not found'});
            }
        });
    });
    request.on('error', function (e) {
        res.status(404);
        let output = req.params;
        output.error = 'Not found';
        res.send(output);
    });
    request.end();
};

exports.renderInfo = function (req, res) {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ip !== "::1" && ip !== "::ffff:127.0.0.1") {
        res.status(403);
        res.send({error: 'Forbidden', ip: ip});
        return;
    }

    let baseUrl = req.protocol + '://' + req.get('host');

    let url = config.getImageServerUrl() + '/' + req.params.id + '/info.json';
    let request = http.request(url, function (res2) {
        var data = '';
        res2.on('data', function (chunk) {
            data += chunk;
        });
        res2.on('end', function () {
            try {
                let manifest = JSON.parse(data);
                /*manifest["@id"] = manifest["@id"].replace(config.getImageServerUrl(), baseUrl + '/iiif/image/');
                manifest.service = {
                    "@context": "http://iiif.io/api/auth/1/context.json",
                    "@id": baseUrl + "/users/login",
                    "confirmLabel": "Login",
                    "description": "Login to IISH",
                    "failureDescription": "<a href=\"http://example.org/policy\">Access Policy</a>",
                    "failureHeader": "Authentication Failed",
                    "header": "Please Log In",
                    "label": "Login to IISH",
                    "profile": "http://iiif.io/api/auth/1/login",
                    "service": [
                        {
                            "@id": baseUrl + "/iiif/auth/token",
                            "profile": "http://iiif.io/api/auth/1/token"
                        }
                    ]
                };

                if (req.headers.authorization !== "Bearer 1234") {
                    res.status(401);
                } else {
                    res.status(200);
                }*/

                res.send(manifest);
            } catch (err) {
                res.status(404);
                res.send({error: 'Not found'});
            }
        });
    });
    request.on('error', function (e) {
        res.status(404);
        res.send({error: 'Not found'});
    });
    request.end();
};