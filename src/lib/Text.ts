import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as libxmljs from 'libxmljs2';
import {Attribute} from 'libxmljs2';

import config from '../lib/Config';
import getClient, {search, DeleteByQueryRequest, IndexBulkRequest} from './ElasticSearch';

export interface Text {
    id: string;
    item_id: string;
    collection_id: string;
    type: string;
    language: string | null;
    uri: string;
    source: string;
    text: string;
}

export interface OcrWord {
    x: number;
    y: number;
    width: number;
    height: number;
    word: string;
}

const readFileAsync = promisify(fs.readFile);

export async function indexTexts(textItems: Text[]): Promise<void> {
    try {
        while (textItems.length > 0) {
            const body = textItems
                .splice(0, 100)
                .map(item => [
                    {index: {_index: 'texts', _id: item.id}},
                    item
                ]);

            await getClient().bulk(<IndexBulkRequest<'texts', Text>>{
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
    await getClient().deleteByQuery(<DeleteByQueryRequest>{
        index: 'texts',
        q: `collection_id:${collectionId}`,
        body: {}
    });
}

export async function getTextsForCollectionId(collectionId: string, type?: string, source?: string): Promise<Text[]> {
    if (type && source)
        return getTexts(`collection_id:"${collectionId}" AND type:"${type}" AND source:"${source}"`);

    if (type)
        return getTexts(`collection_id:"${collectionId}" AND type:"${type}"`);

    if (source)
        return getTexts(`collection_id:"${collectionId}" AND source:"${source}"`);

    return getTexts(`collection_id:"${collectionId}`);
}

async function getTexts(q: string): Promise<Text[]> {
    return search<Text>('texts', q);
}

export async function readAlto(uri: string): Promise<OcrWord[]> {
    const altoXml = await readFileAsync(uri, 'utf8');
    const alto = libxmljs.parseXml(altoXml);
    return alto.find('//String').map(stringElem => {
        return {
            x: parseInt((stringElem.attr('VPOS') as Attribute).value()),
            y: parseInt((stringElem.attr('HPOS') as Attribute).value()),
            width: parseInt((stringElem.attr('WIDTH') as Attribute).value()),
            height: parseInt((stringElem.attr('HEIGHT') as Attribute).value()),
            word: (stringElem.attr('CONTENT') as Attribute).value()
        };
    });
}

export function getFullPath(item: Text): string {
    return path.join(config.dataRootPath, config.collectionsRelativePath, item.uri);
}
