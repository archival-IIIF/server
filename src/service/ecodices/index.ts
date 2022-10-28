import {basename, join, parse} from 'path';

import config from '../../lib/Config.js';
import logger from '../../lib/Logger.js';
import {runTask} from '../../lib/Task.js';
import {createItem, indexItems} from '../../lib/Item.js';
import {ImageItem, Item, RangeItem} from '../../lib/ItemInterfaces.js';
import {readdirAsync, sizeOf, statAsync} from '../../lib/Promisified.js';
import {CollectionPathParams, MetadataParams} from '../../lib/ServiceTypes.js';

import {parseLabel} from './util/fileinfo.js'

import {cleanup} from '../util/index_utils.js';
import {processCollection} from '../util/archivematica.js';
import {pronomByExtension} from '../util/archivematica_pronom_data.js';

interface CollectionProcessingResult {
    rootItem: Item,
    childItems: Item[],
    rangeItems: Item[]
}

export default async function processFolderDemo({collectionPath}: CollectionPathParams): Promise<void> {
    try {
        const {rootItem, childItems, rangeItems} = await processCollectionDemo(collectionPath);

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

async function processCollectionDemo(collectionPath: string): Promise<CollectionProcessingResult> {
    const relativeRootPath = collectionPath
        .replace(`${config.dataRootPath}/${config.collectionsRelativePath}/`, '');
    const collectionId = basename(collectionPath);

    const childItems: ImageItem[] = [], rangeItems: RangeItem[] = [];
    const files = await readdirAsync(collectionPath);
    await Promise.all(files.map(file => processFileDemo(collectionId, relativeRootPath, file, childItems, rangeItems)));

    const rootItem = createItem({
        id: collectionId,
        collection_id: collectionId,
        type: 'root',
        label: collectionId
    });

    return {rootItem, childItems, rangeItems};
}

async function processFileDemo(collectionId: string, relativeRootPath: string, file: string,
                               childItems: ImageItem[], rangeItems: RangeItem[]): Promise<void> {
    const filename = basename(file);
    const parsedFileName = parse(filename);
    const path = join(config.dataRootPath, config.collectionsRelativePath, relativeRootPath, file);

    const stats = await statAsync(path);
    const dimensions = await sizeOf(path);
    if (!dimensions || !dimensions.width || !dimensions.height)
        throw new Error(`Couldn't determine the image dimensions of ${file}`);

    const childItem = createItem({
        id: filename,
        parent_id: collectionId,
        parent_ids: [collectionId],
        collection_id: collectionId,
        type: 'image',
        label: filename,
        size: stats.size,
        order: 0,
        created_at: stats.ctime,
        width: dimensions.width,
        height: dimensions.height,
        resolution: 300,
        access: {
            uri: join(relativeRootPath, file),
            puid: pronomByExtension[parsedFileName.ext.toLowerCase()]
        }
    }) as ImageItem;
    childItems.push(childItem);

    processFile(collectionId, childItem, rangeItems);
}

export async function processFolder({collectionPath}: CollectionPathParams): Promise<void> {
    try {
        const {rootItem, childItems} = await processCollection(collectionPath, {type: 'root'});
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
        createRangeItem(childItem, rangeItems, null, collectionId, `${collectionId}_${fileInfo.type.code}_Range`, fileInfo.type.name);

    if (fileInfo.isFrontEndPaper || fileInfo.isBackEndPaper) {
        const parentId = `${collectionId}_Contents_Range`;
        createRangeItem(null, rangeItems, null, collectionId, parentId, 'Contents');

        if (fileInfo.isFrontEndPaper)
            createRangeItem(childItem, rangeItems, parentId, collectionId, `${collectionId}_FrontEndPapers_Range`, 'Frontend papers');
        else if (fileInfo.isBackEndPaper)
            createRangeItem(childItem, rangeItems, parentId, collectionId, `${collectionId}_BackEndPapers_Range`, 'Backend papers');
    }
}

function createRangeItem(childItem: ImageItem | null, rangeItems: RangeItem[], parentRangeId: string | null,
                         collectionId: string, id: string, label: string): void {
    childItem?.range_ids?.push(id);
    if (!rangeItems.find(item => item.id === id))
        rangeItems.push(createItem({
            id,
            parent_id: parentRangeId,
            parent_ids: parentRangeId ? [parentRangeId] : [],
            collection_id: collectionId,
            type: 'range',
            label
        }) as RangeItem);
}

function sortImageItems(a: ImageItem, b: ImageItem): number {
    const parsedA = parseLabel(a.label);
    const parsedB = parseLabel(b.label);

    if (parsedA.hasColorChecker && !parsedA.type && parsedA.pages.length === 0)
        return 1;

    if (parsedB.hasColorChecker && !parsedB.type && parsedB.pages.length === 0)
        return -1;

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

        if (pageA.subFolio && pageB.subFolio && pageA.subFolio !== pageB.subFolio)
            return pageA.subFolio.localeCompare(pageB.subFolio);

        if ((pageA.isVerso || pageA.isRecto) && (pageB.isVerso || pageB.isRecto) &&
            !(pageA.isVerso && pageB.isVerso) && !(pageA.isRecto && pageB.isRecto))
            return pageA.isRecto ? -1 : 1;
    }

    const aBonusNote = parsedA.isBonus || parsedA.isNote;
    const bBonusNote = parsedB.isBonus || parsedB.isNote;

    const aIccRuler = parsedA.hasColorChecker || parsedA.hasRuler;
    const bIccRuler = parsedB.hasColorChecker || parsedB.hasRuler;

    if ((aBonusNote && bIccRuler) || (bBonusNote && aIccRuler))
        return aBonusNote && bIccRuler ? -1 : 1;

    if ((aBonusNote && !bBonusNote) || (bBonusNote && !aBonusNote))
        return aBonusNote ? 1 : -1;

    if ((aIccRuler && !bIccRuler) || (bIccRuler && !aIccRuler))
        return aIccRuler ? 1 : -1;

    return 0;
}
