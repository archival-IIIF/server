const fs = require('fs');
const path = require('path');
const libxmljs = require('libxmljs');

class Druid {
    constructor() {
        this.cache = {};
        const xml = fs.readFileSync(path.join(__dirname + '/../../config/DROID_SignatureFile_V93.xml'), 'utf8');
        this.druid = libxmljs.parseXml(xml);
    }

    getByPuid(puid) {
        if (this.cache.hasOwnProperty(puid)) {
            return this.cache[puid];
        }

        const namespaces = {"p": "http://www.nationalarchives.gov.uk/pronom/SignatureFile"};
        const node = this.druid.get(`//p:FileFormatCollection/p:FileFormat[@PUID="${puid}"]`, namespaces);

        if (!node) {
            this.cache[puid] = false;
            return false;
        }

        const id = node.attr("ID").value();
        const extension = node.get('./p:Extension', namespaces).text();

        const result = {
            id: id,
            name: node.attr("Name").value(),
            url: `https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=${id}`,
            extension: extension
        };
        this.cache[puid] = result;

        return result;
    }
}

module.exports = new Druid();
