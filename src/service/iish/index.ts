import {XmlNode} from 'libxml2-wasm';

import logger from '../../lib/Logger.js';
import {indexItems} from '../../lib/Item.js';
import {CollectionPathParams} from '../../lib/ServiceTypes.js';

import {cleanup, runTasks} from '../util/index_utils.js';
import {processCollection, ns} from '../util/archivematica.js';
import {fixMissingMetadata} from '../util/fix_missing_metadata.js';

export default async function processDip({collectionPath}: CollectionPathParams): Promise<void> {
    try {
        const {rootItem, childItems, textItems} = await processCollection(collectionPath, {
            type: 'custom',
            customStructMapId: 'structMap_iish',
            isFile: (label: string, parents: string[]) => parents[0] !== 'transcription' && !parents[0].startsWith('translation_'),
            isText: (label: string, parents: string[]) => parents[0] === 'transcription' || parents[0].startsWith('translation_'),
            getTypeAndLang: (label: string, parents: string[]) => ({
                type: parents[0].startsWith('translation_') ? 'translation' : 'transcription',
                language: parents[0].startsWith('translation_') ? parents[0].split('_')[1] : null
            }),
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
                    .find(id => id && id !== fileId) as string;
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
