import iconv from 'iconv-lite';
import {join, extname} from 'path';

import config from '../lib/Config.js';
import {TextParams} from '../lib/ServiceTypes.js';
import {readFileAsync} from '../lib/Promisified.js';
import {indexTexts, deleteTexts} from '../lib/Text.js';

import fixCommonUTF8Problems from './util/unicode_debug_mapping.js';
import {getTextFromStructure, readAlto, TextStructure} from '../lib/TextStructure.js';

export default async function processText({collectionId, items}: TextParams) {
    try {
        const textItems = await Promise.all(items.map(async item => {
            const path = join(config.dataRootPath, config.collectionsRelativePath, item.uri);

            const source = getTextSource(path);
            const structure = await getTextStructure(path);
            const text = await getText(path, item.encoding, structure);

            return {
                id: item.id,
                item_id: item.itemId,
                collection_id: collectionId,
                type: item.type,
                language: item.language,
                uri: item.uri,
                source,
                text,
                structure
            };
        }));

        await deleteTexts(collectionId);
        await indexTexts(textItems.filter(textItem => textItem.text !== ''));
    }
    catch (e: any) {
        const err = new Error(`Failed to process the texts for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

function getTextSource(uri: string): 'alto' | 'plain' {
    const extension = extname(uri);
    switch (extension) {
        case '.xml':
            return 'alto';
        case '.txt':
        default:
            return 'plain';
    }
}

export async function getTextStructure(uri: string): Promise<TextStructure | null> {
    const extension = extname(uri);
    switch (extension) {
        case '.xml':
            return readAlto(uri);
        default:
            return null;
    }
}

export async function getText(uri: string, encoding: string | null, structure: TextStructure | null): Promise<string> {
    if (structure)
        return getTextFromStructure(structure);

    const textBuffer = await readFileAsync(uri);
    const encodedText = iconv.decode(textBuffer, encoding || 'utf8');
    const fixedText = encoding ? encodedText : fixCommonUTF8Problems(encodedText);
    return fixedText.normalize();
}
