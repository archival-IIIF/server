import {basename, parse, join} from 'path';

import config from '../../lib/Config.js';
import logger from '../../lib/Logger.js';
import {runTask} from '../../lib/Task.js';
import {evictCache} from '../../lib/Cache.js';
import {CollectionPathParams, MetadataParams} from '../../lib/ServiceTypes.js';
import {ImageItem, Item, RangeItem} from '../../lib/ItemInterfaces.js';
import {createItem, deleteItems, indexItems} from '../../lib/Item.js';
import {readdirAsync, sizeOf, statAsync} from '../../lib/Promisified.js';

import {parseLabel} from './util/fileinfo.js'
import {pronomByExtension} from '../util/archivematica_pronom_data.js';

interface CollectionProcessingResult {
    rootItem: Item,
    childItems: Item[],
    rangeItems: Item[]
}

export default async function processFolder({collectionPath}: CollectionPathParams): Promise<void> {
    try {
        const {rootItem, childItems, rangeItems} = await processCollection(collectionPath);

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

async function processCollection(collectionPath: string): Promise<CollectionProcessingResult> {
    const relativeRootPath = collectionPath
        .replace(`${config.dataRootPath}/${config.collectionsRelativePath}/`, '');
    const collectionId = basename(collectionPath);

    const childItems: ImageItem[] = [], rangeItems: RangeItem[] = [];
    const files = await readdirAsync(collectionPath);
    await Promise.all(files.map(file => processFile(collectionId, relativeRootPath, file, childItems, rangeItems)));

    let i = 0;
    childItems.sort(sortImageItems);
    //childItems.forEach(item => item.order = parseLabel(item.label).isBonus ? i : ++i);
    childItems.forEach(item => item.order = ++i);

    const rootItem = createItem({
        id: collectionId,
        collection_id: collectionId,
        type: 'root',
        label: collectionId
    });

    return {rootItem, childItems, rangeItems};
}

async function processFile(collectionId: string, relativeRootPath: string, file: string,
                           childItems: ImageItem[], rangeItems: RangeItem[]): Promise<void> {
    const filename = basename(file);
    const parsedFileName = parse(filename);
    const label = parsedFileName.name.replace(collectionId + '_', '').trim();
    const path = join(config.dataRootPath, config.collectionsRelativePath, relativeRootPath, file);

    const stats = await statAsync(path);
    const dimensions = await sizeOf(path);
    if (!dimensions || !dimensions.width || !dimensions.height)
        throw new Error(`Couldn't determine the image dimensions of ${file}`);

    const fileInfo = parseLabel(label);

    const childItem = createItem({
        id: parsedFileName.name,
        parent_id: collectionId,
        parent_ids: [collectionId],
        collection_id: collectionId,
        type: 'image',
        label: label,
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

async function cleanup(id: string): Promise<void> {
    await Promise.all([
        deleteItems(id),
        evictCache('collection', id),
        evictCache('manifest', id)
    ]);
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
