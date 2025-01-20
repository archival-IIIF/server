import {readFile} from 'node:fs/promises';
import {XmlDocument} from 'libxml2-wasm';
import logger from './Logger.js';

export interface PronomInfo {
    id: number;
    name: string;
    url: string;
    extensions: string[];
    mime: string;
}

const fileFormatCollection = await parseSignatureFile();

async function parseSignatureFile() {
    logger.debug('Parsing PRONOM information');

    const fileFormatCollection = new Map<string, PronomInfo>();
    const ns = {'p': 'http://www.nationalarchives.gov.uk/pronom/SignatureFile'};
    using xml = XmlDocument.fromBuffer(await readFile('src/lib/DROID_SignatureFile.xml'));

    const fileFormatNodes = xml.find('//p:FileFormatCollection/p:FileFormat', ns);
    for (const fileFormatNode of fileFormatNodes) {
        const idStr = fileFormatNode.get('@ID')?.content;
        const puid = fileFormatNode.get('@PUID')?.content;
        const name = fileFormatNode.get('@Name')?.content;

        if (idStr && puid && name) {
            const id = parseInt(idStr);
            const url = `https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=${id}`;
            const extensions = fileFormatNode.find('./p:Extension', ns).map(ext => ext.content);

            const mimeType = fileFormatNode.get('@MIMEType')?.content;
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

            fileFormatCollection.set(puid, {id, name, url, extensions, mime});
        }
    }

    logger.debug('Parsed PRONOM information into memory');

    return fileFormatCollection;
}

export default fileFormatCollection;
