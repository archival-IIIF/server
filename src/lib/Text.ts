import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {parseXml, Element, Attribute} from 'libxmljs2';

import config from '../lib/Config.js';

import logger from './Logger.js';
import {cache} from './Cache.js';
import getClient from './ElasticSearch.js';
import {ResponseError} from "@elastic/elasticsearch/lib/errors";

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
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
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
        const response = await getClient().get<{ _source: Text }>({index: config.elasticSearchIndexTexts, id: id});
        return response.body._source;
    }
    catch (err: any) {
        if (err instanceof ResponseError && err.statusCode === 404)
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

export async function readAlto(uri: string): Promise<OcrWord[]> {
    return cache('alto', 'alto', uri, async () => {
        const altoXml = await readFileAsync(uri, 'utf8');
        const alto = parseXml(altoXml);
        return alto.find<Element>('//alto:String | //String', ns).map((stringElem, idx) => {
            const word = stringElem.attr('CONTENT')?.value();
            if (!word)
                return null;

            const x = stringElem.attr('HPOS')?.value();
            const y = stringElem.attr('VPOS')?.value();
            const width = stringElem.attr('WIDTH')?.value();
            const height = stringElem.attr('HEIGHT')?.value();

            return {
                idx,
                x: x && parseInt(x),
                y: y && parseInt(y),
                width: width && parseInt(width),
                height: height && parseInt(height),
                word
            };
        }).filter(ocrWord => ocrWord != null) as OcrWord[];
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
