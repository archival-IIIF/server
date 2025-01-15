import {readFileSync} from 'node:fs';
import {XmlDocument} from 'libxml2-wasm';
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
const druid = XmlDocument.fromBuffer(readFileSync('src/lib/DROID_SignatureFile.xml'));

export default function getPronomInfo(puid: string): PronomInfo | null {
    if (puid in cache && cache[puid] !== null)
        return cache[puid];

    logger.debug(`Searching for PRONOM information by PUID ${puid}`);

    const node = druid.root.get(`//p:FileFormatCollection/p:FileFormat[@PUID='${puid}']`, ns);

    if (!node) {
        cache[puid] = null;
        return null;
    }

    logger.debug(`Caching PRONOM information by PUID ${puid}`);

    const idStr = node.get('@ID')?.content;
    const name = node.get('@Name')?.content;

    if (idStr && name) {
        const id = parseInt(idStr);
        const url = `https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=${id}`;
        const extensions = node.find('./p:Extension', ns).map(ext => ext.content);

        const mimeType = node.get('@MIMEType')?.content;
        const mimes = mimeType ? mimeType.split(',') : [];

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
