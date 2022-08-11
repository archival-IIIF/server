import * as fs from 'fs';
import {parseXml, Element} from 'libxmljs2';
import logger from './Logger.js';

export interface PronomInfo {
    id: number;
    name: string;
    url: string;
    extensions: string[];
    mime: string;
}

const cache: { [puid: string]: PronomInfo | null } = {};
const ns = {'p': 'http://www.nationalarchives.gov.uk/pronom/SignatureFile'};
const druid = parseXml(fs.readFileSync('src/lib/DROID_SignatureFile.xml', 'utf8'));

export default function getPronomInfo(puid: string): PronomInfo | null {
    if (puid in cache && cache[puid] !== null)
        return cache[puid];

    logger.debug(`Searching for PRONOM information by PUID ${puid}`);

    const node = druid.get<Element>(`//p:FileFormatCollection/p:FileFormat[@PUID='${puid}']`, ns);

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
        const extensions = node.find<Element>('./p:Extension', ns).map(ext => ext.text());

        const mimeType = node.attr('MIMEType');
        const mimes = mimeType ? mimeType.value().split(',') : [];

        let mime: string | null = null;
        for (let curMime of mimes) {
            curMime = curMime.trim();
            if (!mime || (curMime.indexOf('application') !== 0))
                mime = curMime;
        }

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
