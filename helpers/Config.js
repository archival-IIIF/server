let yaml = require('js-yaml');
let fs = require('fs');

class Config {
    constructor() {
        this.config = yaml.safeLoad(fs.readFileSync('./config/config.yaml', 'utf8'));
    }

    getImageServerUrl() {

        if (!this.config.hasOwnProperty("imageServerUrl")) {
            throw "imageServerUrl is not defined in config/config.yaml!"
        }

        return this.config.imageServerUrl;
    }


    getLogo() {

        if (!this.config.hasOwnProperty("logo")) {
            return false;
        }

        return this.config.logo;
    }

    getPort() {

        let port = parseInt(this.config.port, 10);
        if (port >= 0) {
            return port;
        }

        return 3333;
    }

    getDefaultLang() {
        if (!this.config.hasOwnProperty("defaultLang")) {
            throw "defaultLang is not defined in config/config.yaml!"
        }

        return this.config.defaultLang;
    }

    getDatabase() {
        if (!this.config.hasOwnProperty("database")) {
            throw "database is not defined in config/config.yaml!"
        }

        return this.config.database;
    }

    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
    }

    getBaseUrl() {
        return this.baseUrl;
    }
}

module.exports = new Config();


