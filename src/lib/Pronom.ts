import * as fs from 'fs';
import * as path from 'path';
import * as libxmljs from 'libxmljs2';
import logger from './Logger';

export interface PronomInfo {
    id: number;
    name: string;
    url: string;
    extensions: string[];
    mime: string;
}

const cache: { [puid: string]: PronomInfo | null } = {};
const ns = {'p': 'http://www.nationalarchives.gov.uk/pronom/SignatureFile'};
const druid = libxmljs.parseXml(fs.readFileSync(path.join(__dirname, 'DROID_SignatureFile.xml'), 'utf8'));

export default function getPronomInfo(puid: string): PronomInfo | null {
    if (cache.hasOwnProperty(puid) && cache[puid] !== null)
        return cache[puid];

    logger.debug(`Searching for PRONOM information by PUID ${puid}`);

    const node = druid.get(`//p:FileFormatCollection/p:FileFormat[@PUID='${puid}']`, ns);

    if (!node) {
        cache[puid] = null;
        return null;
    }

    logger.debug(`Caching PRONOM information by PUID ${puid}`);

    const idAttr = node.attr('ID');
    const nameAttr = node.attr('Name');

    if (idAttr && idAttr.value() && nameAttr && nameAttr.value()) {
        const id = parseInt(idAttr.value());
        const name = nameAttr.value();
        const url = `https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=${id}`;
        const extensions = (node.find('./p:Extension', ns) as libxmljs.Element[]).map(ext => ext.text());

        const mimeType = node.attr('MIMEType');
        const mimes = mimeType ? mimeType.value().split(',') : [];

        let mime: string | null = null;
        mimes.forEach(curMime => {
            curMime = curMime.trim();
            if (!mime || (curMime.indexOf('application') !== 0))
                mime = curMime;
        });

        if (mime === null)
            mime = 'application/octet-stream';
        else if (mime === 'audio/mpeg' && extensions.includes('mp3'))
            mime = 'audio/mp3';

        const result = {id, name, url, extensions, mime};
        cache[puid] = result;

        return result;
    }

    return null;
}
