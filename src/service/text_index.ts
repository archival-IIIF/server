import * as fs from 'fs';
import {join, extname} from 'path';
import {promisify} from 'util';
import * as iconv from 'iconv-lite';
// @ts-ignore
import * as jschardet from 'jschardet';

import config from '../lib/Config';
import {TextParams} from '../lib/Service';
import {indexTexts, deleteTexts, readAlto} from '../lib/Text';

const readFileAsync = promisify(fs.readFile);

export default async function processText({collectionId, items}: TextParams) {
    try {
        const textItems = await Promise.all(items.map(async item => {
            const path = join(config.dataRootPath, config.collectionsRelativePath, item.uri);
            const text = await getTextFromFile(path);
            return {
                id: item.id,
                item_id: item.itemId,
                collection_id: collectionId,
                type: item.type,
                language: item.language,
                uri: item.uri,
                text
            };
        }));

        await deleteTexts(collectionId);
        await indexTexts(textItems);
    }
    catch (e) {
        throw new Error(`Failed to process the texts for ${collectionId}: ${e.message}`);
    }
}

export async function getTextFromFile(uri: string): Promise<string> {
    const extension = extname(uri);
    switch (extension) {
        case '.xml':
            return await getAltoText(uri);
        case '.txt':
        default:
            return await getPlainText(uri);
    }
}

async function getPlainText(uri: string): Promise<string> {
    const textBuffer = await readFileAsync(uri);
    const encodingDetection = jschardet.detect(textBuffer) as { encoding: string };
    return iconv.decode(textBuffer, encodingDetection.encoding);
}

async function getAltoText(uri: string): Promise<string> {
    const altoWords = await readAlto(uri);
    return altoWords.map(altoWord => altoWord.word).join(' ');
}
