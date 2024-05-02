import {Element} from 'libxmljs2';

import logger from '../../lib/Logger.js';
import {indexItems} from '../../lib/Item.js';
import {CollectionPathParams} from '../../lib/ServiceTypes.js';

import {cleanup, runTasks} from '../util/index_utils.js';
import {processCollection, ns} from '../util/archivematica.js';

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
            withRootCustomForFile: (rootCustom: Element, fileId: string) => {
                const orderAttr = rootCustom.get<Element>(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/..`, ns)?.attr('ORDER');
                return {
                    order: orderAttr ? parseInt(orderAttr.value()) : null,
                };
            },
            withRootCustomForText: (rootCustom: Element, fileId: string) => {
                const fptrs = rootCustom.find<Element>(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/../mets:fptr`, ns);
                return fptrs
                    .map(fptrElem => fptrElem.attr('FILEID')?.value())
                    .find(id => id && id !== fileId) as string;
            },
        });

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
