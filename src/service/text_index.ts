import iconv from 'iconv-lite';
import {join, extname} from 'node:path';
import {readFile} from 'node:fs/promises';

import config from '../lib/Config.js';
import {indexText} from '../lib/Text.js';
import {TextParams} from '../lib/ServiceTypes.js';

import fixCommonUTF8Problems from './util/unicode_debug_mapping.js';
import {getTextFromStructure, readAlto, TextStructure} from '../lib/TextStructure.js';

export default async function processText({item}: TextParams) {
    try {
        const path = join(config.dataRootPath, config.collectionsRelativePath, item.uri);

        const source = getTextSource(path);
        const structure = await getTextStructure(path);
        const text = await getText(path, item.encoding, structure);

        if (text !== '') {
            await indexText({
                id: item.id,
                item_id: item.itemId,
                collection_id: item.collectionId,
                type: item.type,
                language: item.language,
                uri: item.uri,
                source,
                text,
                structure
            });
        }
    }
    catch (e: any) {
        const err = new Error(`Failed to process the text with id ${item.id} and item ${item.itemId} for ${item.collectionId}: ${e.message}`);
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

    const textBuffer = await readFile(uri);
    const encodedText = iconv.decode(textBuffer, encoding || 'utf8');
    const fixedText = encoding ? encodedText : fixCommonUTF8Problems(encodedText);
    return fixedText.normalize();
}
