let fs = require('fs');
var xpath = require('xpath'), dom = require('xmldom').DOMParser;

class Druid {
    constructor() {
        this.cache = {};
        let xml = fs.readFileSync('./config/DROID_SignatureFile_V93.xml', 'utf8');
        this.druid = new dom().parseFromString(xml);
    }

    getByPuid(puid) {

        if (this.cache.hasOwnProperty(puid)) {
            return this.cache[puid];
        }

        let select = xpath.useNamespaces({"p": "http://www.nationalarchives.gov.uk/pronom/SignatureFile"});
        let nodes = select('//p:FileFormatCollection/p:FileFormat[@PUID="' + puid + '"]', this.druid);

        if (nodes[0] === undefined) {
            this.cache[puid] = false;
            return false;
        }

        let n = nodes[0];

        let id = n.getAttribute("ID");

        let extension = n.getElementsByTagName('Extension')[0].textContent;

        let result = {
            id: id,
            name: n.getAttribute("Name"),
            url: "https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=" + id,
            extension: extension
        };

        this.cache[puid] = result;

        return result;
    }


}

module.exports = new Druid();


