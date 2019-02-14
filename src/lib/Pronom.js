const fs = require('fs');
const path = require('path');
const libxmljs = require('libxmljs');
const logger = require('./Logger');

const cache = {};
const ns = {'p': 'http://www.nationalarchives.gov.uk/pronom/SignatureFile'};
const druid = libxmljs.parseXml(fs.readFileSync(path.join(__dirname, 'DROID_SignatureFile.xml'), 'utf8'));

function getPronomInfo(puid) {
    if (cache.hasOwnProperty(puid))
        return cache[puid];

    logger.debug(`Searching for PRONOM information by PUID ${puid}`);

    const node = druid.get(`//p:FileFormatCollection/p:FileFormat[@PUID='${puid}']`, ns);

    if (!node) {
        cache[puid] = false;
        return false;
    }

    logger.debug(`Caching PRONOM information by PUID ${puid}`);

    const id = parseInt(node.attr('ID').value());
    const name = node.attr('Name').value();
    const url = `https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=${id}`;
    const extensions = node.find('./p:Extension', ns).map(ext => ext.text());
    const mimes = node.attr('MIMEType') ? node.attr('MIMEType').value().split(',') : [];

    let mime = null;
    mimes.forEach(curMime => {
        curMime = curMime.trim();
        if (!mime || (curMime.indexOf('application') !== 0))
            mime = curMime;
    });

    if (mime === 'audio/mpeg' && extensions.includes('mp3'))
        mime = 'audio/mp3';

    const result = {id, name, url, extensions, mime};
    cache[puid] = result;

    return result;
}

module.exports = getPronomInfo;
