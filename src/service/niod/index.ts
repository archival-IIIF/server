import {XmlNode} from 'libxml2-wasm';

import logger from '../../lib/Logger.ts';
import {indexItems} from '../../lib/Item.ts';
import type {CollectionPathParams} from '../../lib/ServiceTypes.ts';

import {cleanup, runTasks} from '../util/index_utils.ts';
import {processCollection, ns} from '../util/archivematica.ts';
import {fixMissingMetadata} from '../util/fix_missing_metadata.ts';

export default async function processDip({collectionPath}: CollectionPathParams): Promise<void> {
    try {
        const {rootItem, childItems, textItems} = await processCollection(collectionPath, {
            type: 'custom',
            customStructMapId: 'structMap_niod',
            isFile: (label: string, parents: string[]) => parents[0] !== 'transcription',
            isText: (label: string, parents: string[]) => parents[0] === 'transcription',
            getTypeAndLang: (label: string, parents: string[]) =>
                ({type: 'transcription', language: null}),
            withRootCustomForFile: (rootCustom: XmlNode, fileId: string) => {
                const orderAttr = rootCustom.get(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/../@ORDER`, ns);
                return {
                    order: orderAttr ? parseInt(orderAttr.content) : null,
                };
            },
            withRootCustomForText: (rootCustom: XmlNode, fileId: string) => {
                const fptrs = rootCustom.find(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/../mets:fptr`, ns);
                return fptrs
                    .map(fptrElem => fptrElem.get('@FILEID')?.content)
                    .find(id => id && id !== fileId)!;
            },
        });

        await fixMissingMetadata(childItems);

        logger.debug(`Collection ${collectionPath} processed; running cleanup and index`);

        await cleanup(rootItem.id);
        await indexItems([rootItem, ...childItems]);

        logger.debug(`Collection ${collectionPath} indexed; running metadata index, text index and derivative services`);

        runTasks(rootItem.id, childItems, textItems);
    }
    catch (e: any) {
        const err = new Error(`Failed to index the collection ${collectionPath}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}
