import * as path from 'node:path';

import config from './Config.js';
import logger from './Logger.js';
import getClient from './ElasticSearch.js';
import {TextStructure} from './TextStructure.js';

export interface Text {
    id: string;
    item_id: string;
    collection_id: string;
    type: 'transcription' | 'translation';
    language: string | null;
    uri: string;
    source: 'plain' | 'alto';
    text: string;
    structure: TextStructure | null;
}

export async function indexText(textItem: Text): Promise<void> {
    try {
        await getClient().index({
            index: config.elasticSearchIndexTexts,
            id: textItem.id,
            document: textItem
        });
    }
    catch (e) {
        throw new Error('Failed to index the text item!');
    }
}

export async function deleteTexts(collectionId: string): Promise<void> {
    await getClient().deleteByQuery({
        index: config.elasticSearchIndexTexts,
        q: `collection_id:${collectionId}`
    });
}

export async function getText(id: string): Promise<Text | null> {
    try {
        const response = await getClient().get<Text>({index: config.elasticSearchIndexTexts, id: id});
        return response._source || null;
    }
    catch (err: any) {
        if (err.statusCode === 404)
            return null;
        throw err;
    }
}

export function getTextsForCollectionId(collectionId: string, type?: string,
                                        language?: string | null): AsyncIterable<Text> {
    if (!type && !language)
        return getTexts(`collection_id:"${collectionId}"`);

    if (type && language)
        return getTexts(`collection_id:"${collectionId}" AND type:"${type}" AND language:"${language}"`);

    return getTexts(`collection_id:"${collectionId}" AND type:"${type}" AND NOT _exists_:language`);
}

function getTexts(q: string): AsyncIterable<Text> {
    try {
        logger.debug(`Obtain texts from ElasticSearch with query "${q}"`);
        return getClient().helpers.scrollDocuments<Text>({
            index: config.elasticSearchIndexTexts,
            size: 10_000,
            q
        });
    }
    catch (err: any) {
        throw err;
    }
}

export function getFullPath(item: Text): string {
    return path.join(config.dataRootPath, config.collectionsRelativePath, item.uri);
}

// TODO: Replace with Array.fromAsync when available
export async function withTexts(asyncTexts: AsyncIterable<Text>): Promise<Text[]> {
    const texts = [];
    for await (const text of asyncTexts)
        texts.push(text);
    return texts;
}
