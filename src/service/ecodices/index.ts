import {parse} from 'node:path';

import logger from '../../lib/Logger.js';
import {runTask} from '../../lib/Task.js';
import {createItem, indexItems} from '../../lib/Item.js';
import {ImageItem, RangeItem} from '../../lib/ItemInterfaces.js';
import {CollectionPathParams, MetadataParams} from '../../lib/ServiceTypes.js';

import {parseLabel} from './util/fileinfo.js'

import {cleanup} from '../util/index_utils.js';
import {processCollection} from '../util/archivematica.js';
import {fixMissingMetadata} from '../util/fix_missing_metadata.js';

export default async function processForIndex({collectionPath}: CollectionPathParams): Promise<void> {
    try {
        const {rootItem, childItems} = await processCollection(collectionPath, {type: 'root'});
        await fixMissingMetadata(childItems);

        const rangeItems = processItems(rootItem.collection_id, childItems as ImageItem[]);

        logger.debug(`Collection ${collectionPath} processed; running cleanup and index`);

        await cleanup(rootItem.id);
        await indexItems([rootItem, ...childItems, ...rangeItems]);

        logger.debug(`Collection ${collectionPath} indexed; running metadata index`);

        runTask<MetadataParams>('metadata', {collectionId: rootItem.id});
    }
    catch (e: any) {
        const err = new Error(`Failed to index the collection ${collectionPath}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

function processItems(collectionId: string, childItems: ImageItem[]): RangeItem[] {
    const rangeItems: RangeItem[] = [];
    for (const childItem of childItems)
        processFile(collectionId, childItem, rangeItems);

    let i = 0;
    childItems.sort(sortImageItems);
    childItems.forEach(item => item.order = ++i);

    return rangeItems;
}

function processFile(collectionId: string, childItem: ImageItem, rangeItems: RangeItem[]): void {
    const filename = childItem.label;
    const parsedFileName = parse(filename);
    const label = parsedFileName.name.replace(collectionId + '_', '').trim();
    childItem.label = label;

    const fileInfo = parseLabel(label);
    if (fileInfo.type)
        createRangeItem(childItem, rangeItems, collectionId, `${collectionId}_${fileInfo.type.code}_Range`, fileInfo.type.name);
    if (fileInfo.isFrontEndPaper)
        createRangeItem(childItem, rangeItems, collectionId, `${collectionId}_FrontEndPapers_Range`, 'Front endpapers');
    if (fileInfo.isBackEndPaper)
        createRangeItem(childItem, rangeItems, collectionId, `${collectionId}_BackEndPapers_Range`, 'Back endpapers');
}

function createRangeItem(childItem: ImageItem, rangeItems: RangeItem[],
                         collectionId: string, id: string, label: string): void {
    childItem.range_ids.push(id);
    if (!rangeItems.find(item => item.id === id))
        rangeItems.push(createItem({
            id,
            collection_id: collectionId,
            type: 'range',
            label
        }) as RangeItem);
}

function sortImageItems(a: ImageItem, b: ImageItem): number {
    const parsedA = parseLabel(a.label);
    const parsedB = parseLabel(b.label);

    if (parsedA.hasColorChecker && !parsedB.hasColorChecker ||
        parsedB.hasColorChecker && !parsedA.hasColorChecker)
        return parsedA.hasColorChecker ? 1 : -1;

    if (parsedA.type?.code === 'OpenView' && parsedB.type?.code !== 'OpenView' ||
        parsedB.type?.code === 'OpenView' && parsedA.type?.code !== 'OpenView')
        return parsedA.type?.code === 'OpenView' ? 1 : -1;

    if ((parsedA.isNote || parsedA.isFolium) && !(parsedB.isNote || parsedB.isFolium) ||
        (parsedB.isNote || parsedB.isFolium) && !(parsedA.isNote || parsedA.isFolium))
        return parsedA.isNote || parsedA.isFolium ? 1 : -1;

    if (parsedA.type && parsedB.type && parsedA.type.code !== parsedB.type.code)
        return parsedA.type.order - parsedB.type.order;

    if (parsedA.type && !parsedB.type)
        return parsedA.type.beforePages ? -1 : 1;

    if (parsedB.type && !parsedA.type)
        return parsedB.type.beforePages ? 1 : -1;

    if ((parsedA.isFrontEndPaper && !parsedB.isFrontEndPaper) ||
        (parsedB.isFrontEndPaper && !parsedA.isFrontEndPaper))
        return parsedA.isFrontEndPaper ? -1 : 1;

    if ((parsedA.isBackEndPaper && !parsedB.isBackEndPaper) ||
        (parsedB.isBackEndPaper && !parsedA.isBackEndPaper)) {
        if (parsedA.isBackEndPaper)
            return parsedB.pages.length > 0 ? 1 : -1;

        if (parsedB.isBackEndPaper)
            return parsedA.pages.length > 0 ? -1 : 1;
    }

    if (parsedA.pages.length > 0 && parsedB.pages.length > 0) {
        const pageA = parsedA.pages[0];
        const pageB = parsedB.pages[0];

        if (pageA.folioPageNumber && pageB.folioPageNumber && pageA.folioPageNumber !== pageB.folioPageNumber)
            return pageA.folioPageNumber - pageB.folioPageNumber;

        if (pageA.subFolioPage && pageB.subFolioPage && pageA.subFolioPage !== pageB.subFolioPage)
            return pageA.subFolioPage.localeCompare(pageB.subFolioPage);

        if (pageA.subFolioPage && !pageB.subFolioPage ||
            pageB.subFolioPage && !pageA.subFolioPage)
            return pageA.subFolioPage ? 1 : -1;

        if ((pageA.isVerso || pageA.isRecto) && (pageB.isVerso || pageB.isRecto) &&
            !(pageA.isVerso && pageB.isVerso) && !(pageA.isRecto && pageB.isRecto))
            return pageA.isRecto ? -1 : 1;
    }

    if ((parsedA.isBonus && parsedB.hasRuler) || (parsedB.isBonus && parsedA.hasRuler))
        return parsedA.isBonus && parsedB.hasRuler ? -1 : 1;

    if ((parsedA.isBonus && !parsedB.isBonus) || (parsedB.isBonus && !parsedA.isBonus))
        return parsedA.isBonus ? 1 : -1;

    if ((parsedA.hasRuler && !parsedB.hasRuler) || (parsedB.hasRuler && !parsedA.hasRuler))
        return parsedA.hasRuler ? 1 : -1;

    return 0;
}
