import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as iconv from 'iconv-lite';
// @ts-ignore
import * as jschardet from 'jschardet';

import config from '../lib/Config';
import {TextParams} from '../lib/Service';
import {indexTexts, deleteTexts, readAlto} from '../lib/Text';

const readFileAsync = promisify(fs.readFile);

export default async function processText({collectionId, items}: TextParams) {
    await deleteTexts(collectionId);

    const textItems = await Promise.all(items.map(async item => {
        const text = await getTextFromFile(item);
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

    await indexTexts(textItems);
}

async function getTextFromFile(item: { uri: string }): Promise<string> {
    const extension = path.extname(item.uri);
    switch (extension) {
        case 'xml':
            return await getAltoText(item);
        case 'txt':
        default:
            return await getPlainText(item);
    }
}

async function getPlainText(item: { uri: string }): Promise<string> {
    const textBuffer = await readFileAsync(path.join(config.dataPath, item.uri));
    const encodingDetection = jschardet.detect(textBuffer) as { encoding: string };
    return iconv.decode(textBuffer, encodingDetection.encoding);
}

async function getAltoText(item: { uri: string }): Promise<string> {
    const altoWords = await readAlto(path.join(config.dataPath, item.uri));
    return altoWords.map(altoWord => altoWord.word).join(' ');
}
