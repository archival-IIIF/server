const fs = require('fs');
const path = require('path');
const libxmljs = require('libxmljs');

const cache = {};
const druid = libxmljs.parseXml(fs.readFileSync(path.join(__dirname, 'DROID_SignatureFile_V93.xml'), 'utf8'));

function getPronomInfo(puid) {
    if (cache.hasOwnProperty(puid))
        return cache[puid];

    const namespaces = {"p": "http://www.nationalarchives.gov.uk/pronom/SignatureFile"};
    const node = druid.get(`//p:FileFormatCollection/p:FileFormat[@PUID="${puid}"]`, namespaces);

    if (!node) {
        cache[puid] = false;
        return false;
    }

    const id = node.attr("ID").value();
    const result = {
        id: id,
        name: node.attr("Name").value(),
        url: `https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=${id}`,
        extensions: node.find('./p:Extension', namespaces).map(ext => ext.text()),
        mime: node.attr("MIMEType") ? node.attr("MIMEType").value() : null
    };
    cache[puid] = result;

    return result;
}

module.exports = getPronomInfo;
