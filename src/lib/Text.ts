import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as libxmljs from 'libxmljs';
import {Attribute} from 'libxmljs';

import config from '../lib/Config';
import getClient from '../lib/ElasticSearch';

export interface Text {
    id: string;
    item_id: string;
    collection_id: string;
    type: string;
    language: string | null;
    uri: string;
    text: string;
}

const readFileAsync = promisify(fs.readFile);

export async function indexTexts(textItems: Text[]): Promise<void> {
    while (textItems.length > 0) {
        const body = textItems.splice(0, 100).map(item => [
            {index: {_index: 'texts', _type: '_doc', _id: item.id}},
            item
        ]);
        const result = await getClient().bulk({refresh: 'wait_for', body: [].concat(...body as [])});
        if (result.errors)
            throw new Error('Failed to index the text items');
    }
}

export async function deleteTexts(collectionId: string): Promise<void> {
    await getClient().deleteByQuery({index: 'texts', q: `collection_id:${collectionId}`});
}

export async function readAlto(uri: string): Promise<{ x: number, y: number, width: number, height: number, word: string }[]> {
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
    return path.join(config.dataPath, item.uri);
}
