import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {parseXml, Element, Attribute} from 'libxmljs2';

import config from '../lib/Config';

import logger from './Logger';
import {cache} from './Cache';
import getClient from './ElasticSearch';

export interface Text {
    id: string;
    item_id: string;
    collection_id: string;
    type: 'transcription' | 'translation';
    language: string | null;
    uri: string;
    source: 'plain' | 'alto';
    text: string;
}

export interface OcrWord {
    idx: number;
    x: number;
    y: number;
    width: number;
    height: number;
    word: string;
}

const readFileAsync = promisify(fs.readFile);

const ns = {
    'alto': 'http://www.loc.gov/standards/alto/ns-v2#'
};

export async function indexTexts(textItems: Text[]): Promise<void> {
    try {
        while (textItems.length > 0) {
            const body = textItems
                .splice(0, 100)
                .map(item => [
                    {index: {_index: config.elasticSearchIndexTexts, _id: item.id}},
                    item
                ]);

            await getClient().bulk({
                refresh: 'wait_for',
                body: [].concat(...body as [])
            });
        }
    }
    catch (e) {
        throw new Error('Failed to index the text items!');
    }
}

export async function deleteTexts(collectionId: string): Promise<void> {
    await getClient().deleteByQuery({
        index: config.elasticSearchIndexTexts,
        q: `collection_id:${collectionId}`,
        body: {}
    });
}

export async function getText(id: string): Promise<Text | null> {
    try {
        const response = await getClient().get({index: config.elasticSearchIndexTexts, id: id});
        return response.body._source;
    }
    catch (err) {
        return null;
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
    logger.debug(`Obtain texts from ElasticSearch with query "${q}"`);
    return getClient().helpers.scrollDocuments<Text>({index: config.elasticSearchIndexTexts, q});
}

export async function readAlto(uri: string): Promise<OcrWord[]> {
    return cache('alto', 'alto', uri, async () => {
        const altoXml = await readFileAsync(uri, 'utf8');
        const alto = parseXml(altoXml);
        return alto.find<Element>('//alto:String', ns).map((stringElem, idx) => ({
            idx,
            x: parseInt((stringElem.attr('HPOS') as Attribute).value()),
            y: parseInt((stringElem.attr('VPOS') as Attribute).value()),
            width: parseInt((stringElem.attr('WIDTH') as Attribute).value()),
            height: parseInt((stringElem.attr('HEIGHT') as Attribute).value()),
            word: (stringElem.attr('CONTENT') as Attribute).value()
        }));
    });
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
