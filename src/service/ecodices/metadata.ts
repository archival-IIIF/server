import {XmlDocument, XmlNode} from 'libxml2-wasm';

import logger from '../../lib/Logger.ts';
import config from '../../lib/Config.ts';
import {getChildItems, getItem, updateItems} from '../../lib/Item.ts';

import type {MetadataParams} from '../../lib/ServiceTypes.ts';
import type {Item, Metadata, MinimalItem} from '../../lib/ItemInterfaces.ts';

import {getCmdi, getCmdiRecordId} from '../util/cmdi.ts';
import {parseLabel, parsePage, equalsPages} from './util/fileinfo.ts';
import type {FileInfo} from './util/fileinfo.ts';

const ns = {
    'cmdp': 'http://www.clarin.eu/cmd/1/profiles/' + config.metadataCmdiProfile
};

const parents: Record<string, { settlement: string, repository: string }> = {
    'ABD': {settlement: 'Deventer', repository: 'Athenaeum Library'},
    'MMW': {settlement: 'Den Haag', repository: 'House of the Book'},
    'TRL': {settlement: 'Leeuwarden', repository: 'Tresoar'},
}

export default async function processMetadata({metadataId, collectionId}: MetadataParams): Promise<void> {
    if (!config.metadataCmdiUrl || !config.metadataCmdiApp || !config.metadataCmdiProfile)
        throw new Error('Cannot process metadata, as there is no CMDI editor URL, app and/or profile configured!');

    if (!metadataId && !collectionId)
        throw new Error('Cannot process metadata, as there is no metadata id or collection id provided!');

    try {
        let recordId: number | null = metadataId ? parseInt(metadataId) : null;
        recordId = recordId && isNaN(recordId) ? null : recordId;

        if (!recordId && collectionId)
            recordId = await findRecordIdByCollectionId(collectionId);

        if (recordId)
            await updateWithRecordId(recordId, collectionId);
    } catch (e: any) {
        const err = new Error(`Failed to process the metadata for ${metadataId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

async function findRecordIdByCollectionId(id: string): Promise<number | null> {
    const collectionId = id.replaceAll('_', ' ');
    let recordId = await getCmdiRecordId(collectionId.substring(4));
    if (recordId)
        return recordId;

    recordId = await getCmdiRecordId(collectionId);
    if (recordId)
        return recordId;

    return null;
}

async function updateWithRecordId(recordId: number, itemId?: string): Promise<void> {
    using cmdi = XmlDocument.fromBuffer(await getCmdi(recordId, 'xml'));
    const eCodicesRoot = cmdi.get('//cmdp:eCodices', ns);
    if (!eCodicesRoot)
        throw new Error('Missing an eCodices root element!');

    const shelfmark = getTexts(eCodicesRoot, './cmdp:Source/cmdp:MsIdentifier/cmdp:shelfmark', true)[0];

    let parentId = itemId ? itemId.substring(0, 3) : shelfmark.substring(0, 3);
    itemId ??= shelfmark.replaceAll(' ', '_');
    let item = await getItem(itemId);
    if (!item) {
        // TODO: Workaround by prefixing shelfmark with 'ABD', 'MMW' or 'TRL'
        const orgItemId = itemId;
        for (parentId of Object.keys(parents)) {
            itemId = `${parentId}_${orgItemId}`;
            item = await getItem(itemId);
            if (item)
                break;
        }
    }

    if (!item || item.type !== 'root')
        throw new Error(`No root item found for collection ${itemId}`);

    const childItems = await getChildItems(item);

    const items = extractMetadata(recordId, parentId, itemId, eCodicesRoot);
    const {items: childUpdatedItems, ranges} = extractRanges(childItems, itemId, eCodicesRoot);

    await updateItems(items.concat(childUpdatedItems).concat(ranges));

    logger.debug(`Updated metadata for ${recordId}`);
}

function extractMetadata(recordId: number, parentId: string, itemId: string, eCodicesRoot: XmlNode): MinimalItem[] {
    const settlement = getTexts(eCodicesRoot, './cmdp:Source/cmdp:MsIdentifier/cmdp:settlement', false, parents[parentId].settlement)[0];
    const repository = getTexts(eCodicesRoot, './cmdp:Source/cmdp:MsIdentifier/cmdp:repository', false, parents[parentId].repository)[0];

    const license = getTexts(eCodicesRoot, './cmdp:Source/cmdp:Additional/cmdp:Availability/cmdp:licenceUri');

    const title = getTexts(eCodicesRoot, './cmdp:Title/cmdp:title', true)[0];
    const summary = getTexts(eCodicesRoot, './cmdp:Source/cmdp:ManuscriptDescription/cmdp:Summary/cmdp:summary', true)[0];
    const physical = getTexts(eCodicesRoot, './cmdp:Source/cmdp:PhysDesc/cmdp:Part/cmdp:SupportDesc/cmdp:Material/cmdp:material');

    const metadataCollection = [...physical];
    metadataCollection.push(...getTexts(eCodicesRoot, './cmdp:Source/cmdp:PhysDesc/cmdp:Part/cmdp:SupportDesc/cmdp:Extent/cmdp:MeasureLeavesCount/cmdp:measure').map(count => `${count} ff.`));
    metadataCollection.push(...eCodicesRoot.find('./cmdp:Source/cmdp:PhysDesc/cmdp:Part/cmdp:SupportDesc/cmdp:Extent/cmdp:MeasurePageDimensions', ns).map(dimElem => {
        const height = getTexts(dimElem, './cmdp:height', true)[0];
        const width = getTexts(dimElem, './cmdp:width', true)[0];
        return `${height.substring(0, height.lastIndexOf(' '))} x ${width}`;
    }));
    metadataCollection.push(...getTexts(eCodicesRoot, './cmdp:Source/cmdp:History/cmdp:Origin/cmdp:Part/cmdp:origPlace').filter(v => v !== 'unknown'));
    metadataCollection.push(...getTexts(eCodicesRoot, './cmdp:Source/cmdp:History/cmdp:Origin/cmdp:Part/cmdp:origDate').filter(v => v !== 'unknown'));

    const recordMetadata: Metadata[] = [];
    const collectionMetadata: Metadata[] = [];

    addMetadata(collectionMetadata, 'Repository', repository);
    addMetadata(collectionMetadata, 'Settlement', settlement);

    addMetadata(recordMetadata, '', metadataCollection.join(' · '));
    addMetadata(recordMetadata, 'Language', [
        ...getTexts(eCodicesRoot, './cmdp:Source/cmdp:Contents/cmdp:textLang/cmdp:textLang'),
        ...getTexts(eCodicesRoot, './cmdp:Source/cmdp:Contents/cmdp:textLang/cmdp:otherLang')
    ]);
    addMetadata(recordMetadata, 'Summary', summary);
    addMetadata(recordMetadata, 'Rights', getTexts(eCodicesRoot, './cmdp:Source/cmdp:Additional/cmdp:Availability/cmdp:licence'));
    addMetadata(recordMetadata, 'Publisher', getTexts(eCodicesRoot, './cmdp:Publication/cmdp:publisher'));

    const collection: MinimalItem = {
        id: parentId,
        collection_id: parentId,
        label: repository,
        metadata: collectionMetadata
    };

    const record: MinimalItem = {
        id: itemId,
        parent_id: parentId,
        parent_ids: [parentId],
        collection_id: itemId,
        metadata_id: recordId,
        label: title,
        description: summary,
        physical: physical,
        metadata: recordMetadata,
        ecodices: {
            license: license
        }
    };

    return [collection, record];
}

function extractRanges(childItems: Item[], shelfmark: string, eCodicesRoot: XmlNode):
    { items: MinimalItem[], ranges: MinimalItem[] } {
    const parentRangeId = `${shelfmark}_Contents_Range`;
    const parentRange = {
        id: parentRangeId,
        collection_id: shelfmark,
        type: 'range',
        label: 'Contents'
    };

    const items: MinimalItem[] = [], ranges: MinimalItem[] = [];
    const childsParsed = childItems.map(item => parseLabel(item.label));

    const isPage = (i: FileInfo) => i.pages.length > 0 && !i.type &&
        !i.isFrontEndPaper && !i.isBackEndPaper && !i.hasRuler && !i.hasColorChecker;
    const firstPageFileInfo = childsParsed.find(isPage);
    const lastPageFileInfo = [...childsParsed].reverse().find(isPage);

    for (const itemElem of eCodicesRoot.find('./cmdp:Source/cmdp:ManuscriptDescription/cmdp:Contents/cmdp:Item', ns)) {
        const froms = getTexts(itemElem, './cmdp:locusFrom');
        const tos = getTexts(itemElem, './cmdp:locusTo');

        const fromPage = froms.length === 0 ? firstPageFileInfo?.pages[0] : parsePage(froms[0]);
        const toPage = tos.length === 0 ? lastPageFileInfo?.pages[0] : parsePage(tos[0]);
        if (!fromPage || !toPage)
            throw new Error(`Cannot parse locus for ${froms[0]} and ${tos[0]}!`);

        const fromIdx = childsParsed.findIndex(
            p => p.pages.length > 0 && equalsPages(fromPage, p.pages[0])
                || (p.pages.length === 2 && equalsPages(fromPage, p.pages[1])));
        const toIdx = childsParsed.findIndex(
            p => (p.pages.length > 0 && equalsPages(toPage, p.pages[0]))
                || (p.pages.length === 2 && equalsPages(toPage, p.pages[1]))) + 1;

        if (fromIdx < 0 || toIdx <= 0 || fromIdx >= toIdx || toIdx > childsParsed.length) {
            const missingRange = `Cannot find range for ${froms[0]} till ${tos[0]}!`;
            const fullRange = `Full range is ${firstPageFileInfo?.label} till ${lastPageFileInfo?.label}!`;
            throw new Error(missingRange + ' ' + fullRange);
        }

        const id = (froms.length > 0 && tos.length > 0)
            ? `${shelfmark}_${froms[0]}:${tos[0]}`
            : `${shelfmark}_range`;

        const title = getTexts(itemElem, './cmdp:Title/cmdp:title', true)[0];
        const authors = getTexts(itemElem, './cmdp:Author/cmdp:author');
        const notes = getTexts(itemElem, './cmdp:Note/cmdp:note');

        const rangeMetadata: Metadata[] = [];
        addMetadata(rangeMetadata, 'Language', [
            ...getTexts(itemElem, './cmdp:textLang/cmdp:textLang'),
            ...getTexts(itemElem, './cmdp:textLang/cmdp:otherLang')
        ]);

        items.push(...childItems.slice(fromIdx, toIdx).map(item => ({
            id: item.id,
            collection_id: item.collection_id,
            label: item.label,
            range_ids: item.range_ids.concat([id]),
        })));

        if (ranges.length === 0)
            ranges.push(parentRange);

        ranges.push({
            id: id,
            collection_id: shelfmark,
            parent_id: parentRangeId,
            parent_ids: [parentRangeId],
            type: 'range',
            label: title,
            description: notes.length > 0 ? notes[0] : undefined,
            authors: authors.map(author => ({
                type: 'Author',
                name: author
            })),
            metadata: rangeMetadata
        });
    }

    return {items, ranges};
}

export function getTexts(root: XmlNode, xpath: string, required: boolean = false, defaultValue?: string): string[] {
    const elements = root.find(xpath, ns);
    if (required && elements.length === 0)
        throw new Error(`Missing elements for ${xpath}`);
    else if (elements.length === 0 && defaultValue)
        return [defaultValue];

    return elements.map(el => el.content.trim());
}

function addMetadata(metadata: Metadata[], label: string, value: string | string[]): void {
    value.length > 0 && metadata.push({label, value});
}
