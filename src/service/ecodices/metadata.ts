import {join} from 'path';
import readline from 'readline';
import {parseXml, Element} from 'libxmljs2';
import {createReadStream, existsSync} from 'fs';

import logger from '../../lib/Logger.js';
import config from '../../lib/Config.js';
import {MetadataParams} from '../../lib/ServiceTypes.js';
import {readFileAsync} from '../../lib/Promisified.js';
import {getChildItems, getItem, updateItems} from '../../lib/Item.js';
import {Item, Metadata, MinimalItem} from '../../lib/ItemInterfaces.js';

import {parseLabel, parsePage, equalsPages} from './util/fileinfo.js';

const ns = {
    'cmd': 'http://www.clarin.eu/cmd/'
};

const languageNames = new Intl.DisplayNames(['en'], {type: 'language'});

export default async function processMetadata({metadataId, collectionId}: MetadataParams): Promise<void> {
    if (!config.metadataPath)
        throw new Error('Cannot process metadata, as there is no metadata path configured!');

    if (!metadataId && !collectionId)
        throw new Error('Cannot process metadata, as there is no metadata id or collection id provided!');

    try {
        if (!metadataId && collectionId)
            metadataId = await findMetadataIdByCollectionId(collectionId);

        if (metadataId)
            await updateWithMetadataId(metadataId);
    }
    catch (e: any) {
        const err = new Error(`Failed to process the metadata for ${metadataId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

async function findMetadataIdByCollectionId(id: string): Promise<string | null> {
    const rl = readline.createInterface({
        input: createReadStream(join(config.metadataPath as string, 'mapping.csv'))
    });

    for await (const line of rl) {
        const split = line.split(',');
        if (split.length > 0) {
            const collectionId = split[0]
                .replaceAll('"', '')
                .replaceAll(' ', '_')
                .trim();

            const metadataId = split[1]
                .replaceAll('"', '')
                .trim();

            if (collectionId === id)
                return metadataId;
        }
    }

    return null;
}

async function updateWithMetadataId(metadataId: string): Promise<void> {
    const path = join(config.metadataPath as string, metadataId);
    if (!existsSync(path))
        throw new Error(`No metadata file ${metadataId} found in ${path}`);

    const cmdiXml = await readFileAsync(path, 'utf8');
    const cmdi = parseXml(cmdiXml);

    const eCodicesRoot = cmdi.get<Element>('//cmd:eCodices', ns);
    if (!eCodicesRoot)
        throw new Error('Missing an eCodices root element!');

    const {parentId, collectionId} = getIdentifier(eCodicesRoot);

    const item = await getItem(collectionId);
    if (!item || item.type !== 'root')
        throw new Error(`No root item found for collection ${collectionId}`);

    const childItems = await getChildItems(item);

    const items = extractMetadata(metadataId, parentId, collectionId, eCodicesRoot);
    const {items: childUpdatedItems, ranges} = extractRanges(childItems, collectionId, eCodicesRoot);

    await updateItems(items.concat(childUpdatedItems).concat(ranges));

    logger.debug(`Updated metadata for ${metadataId}`);
}

function extractMetadata(metadataId: string, parentId: string, collectionId: string, eCodicesRoot: Element): MinimalItem[] {
    const settlement = getTexts(eCodicesRoot, './cmd:Source/cmd:Identifier/cmd:Settlement/cmd:settlement', true)[0];
    const repository = getTexts(eCodicesRoot, './cmd:Source/cmd:Identifier/cmd:Repository/cmd:repository', true)[0];

    const license = getTexts(eCodicesRoot, './cmd:Publication/cmd:Availability/cmd:licenceTarget', true)[0];

    const title = getTexts(eCodicesRoot, './cmd:Source/cmd:Head/cmd:Title/cmd:title', true)[0];
    const summary = getTexts(eCodicesRoot, './cmd:Source/cmd:Contents/cmd:Summary/cmd:summary', true)[0];
    const physDesc = getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:additions');
    const formats = getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:ObjectDesc/cmd:form');
    const acquisitor = getTexts(eCodicesRoot, './cmd:Source/cmd:History/cmd:Acquisition/cmd:PersName/cmd:persName');
    const originDates = eCodicesRoot
        .find<Element>('./cmd:Source/cmd:Head/cmd:OrigDate', ns)
        .map(origPlace => origPlace.get('./cmd:note', ns)
            ? `${getTexts(origPlace, './cmd:origDate').join(', ')} (${getTexts(origPlace, './cmd:note')})`
            : `${getTexts(origPlace, './cmd:origDate').join(', ')}`);

    const recordMetadata: Metadata[] = [];
    const collectionMetadata: Metadata[] = [];

    addMetadata(recordMetadata, 'Repository', repository);
    addMetadata(recordMetadata, 'Settlement', settlement);

    addMetadata(collectionMetadata, 'Repository', repository);
    addMetadata(collectionMetadata, 'Settlement', settlement);

    addMetadata(recordMetadata, 'Contents', getTexts(eCodicesRoot, './cmd:Source/cmd:Identifier/cmd:Name'));

    addMetadata(recordMetadata, 'Place of origin', eCodicesRoot
        .find<Element>('./cmd:Source/cmd:Head/cmd:OrigPlace', ns)
        .map(origPlace => origPlace.get('./cmd:note', ns)
            ? `${getTexts(origPlace, './cmd:origPlace').join(', ')} (${getTexts(origPlace, './cmd:note')})`
            : `${getTexts(origPlace, './cmd:origPlace').join(', ')}`));

    addMetadata(recordMetadata, 'Language',
        getTexts(eCodicesRoot, './cmd:Source/cmd:Contents/cmd:textLang/cmd:textLang')
            .map(lang => languageNames.of(lang)) as string[]);

    addMetadata(recordMetadata, 'Material', [
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:ObjectDesc/cmd:SupportDesc/cmd:Support/cmd:support'),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:ObjectDesc/cmd:SupportDesc/cmd:condition'),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:ObjectDesc/cmd:SupportDesc/cmd:Extent/cmd:Measure[not(cmd:type) or cmd:type[not(text())]]/cmd:measure'),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:ObjectDesc/cmd:layoutDesc/cmd:Layout/cmd:Measure/cmd:measure'),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:ObjectDesc/cmd:SupportDesc/cmd:Extent/cmd:Measure/cmd:type[text()=\'leavesCount\']/following-sibling::cmd:measure')
            .map(text => `${text} leaves`),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:Source/cmd:PhysDesc/cmd:ObjectDesc/cmd:SupportDesc/cmd:Extent/cmd:Measure/cmd:type[text()=\'pagesCount\']/following-sibling::cmd:measure')
            .map(text => `${text} pages`),
        ...getTexts(eCodicesRoot, './cmd:PhysDesc/cmd:ObjectDesc/cmd:layoutDesc/cmd:Layout/cmd:Columns/cmd:columns')
            .map(text => `${text} columns`),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:Source/cmd:PhysDesc/cmd:ObjectDesc/cmd:layoutDesc/cmd:Layout/cmd:WrittenLines/cmd:writtenLines')
            .map(text => `${text} lines`),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:HandDesc/cmd:HandNote/cmd:script'),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:DecoDesc/cmd:DecoNote/cmd:decoNote'),
        ...getTexts(eCodicesRoot, './cmd:Source/cmd:PhysDesc/cmd:bindingDesc/cmd:Binding/cmd:binding')
    ]);

    addMetadata(recordMetadata, 'Format', formats);
    addMetadata(recordMetadata, 'Origin', getTexts(eCodicesRoot, './cmd:Source/cmd:History/cmd:Origin/cmd:origin'));
    addMetadata(recordMetadata, 'Provenance', getTexts(eCodicesRoot, './cmd:Source/cmd:History/cmd:Provenance/cmd:provenance'));
    addMetadata(recordMetadata, 'Acquisition', getTexts(eCodicesRoot, './cmd:Source/cmd:History/cmd:Acquisition/cmd:acquisition'));

    const collection: MinimalItem = {
        id: parentId,
        collection_id: parentId,
        label: repository,
        metadata: collectionMetadata
    };

    const record: MinimalItem = {
        id: collectionId,
        parent_id: parentId,
        parent_ids: [parentId],
        collection_id: collectionId,
        metadata_id: metadataId,
        formats: formats,
        label: title,
        description: summary,
        authors: [{
            type: 'Acquisitor',
            name: acquisitor
        }],
        dates: originDates,
        physical: physDesc.length > 0 ? physDesc[0] : undefined,
        metadata: recordMetadata,
        ecodices: {
            license: license
        }
    };

    return [collection, record];
}

function extractRanges(childItems: Item[], collectionId: string, eCodicesRoot: Element):
    { items: MinimalItem[], ranges: MinimalItem[] } {
    const parentRangeId = `${collectionId}_Contents_Range`;
    const parentRange = {
        id: parentRangeId,
        collection_id: collectionId,
        type: 'range',
        label: 'Contents'
    };

    const items: MinimalItem[] = [], ranges: MinimalItem[] = [];
    const childsParsed = childItems.map(item => parseLabel(item.label));

    for (const itemElem of eCodicesRoot.find<Element>('./cmd:Source/cmd:Contents/cmd:Item', ns)) {
        const froms = getTexts(itemElem, './cmd:Locus/cmd:From/cmd:from');
        const tos = getTexts(itemElem, './cmd:Locus/cmd:To/cmd:to');

        const fromPage = (froms.length === 0)
            ? childsParsed.find(p => p.pages.length > 0)?.pages[0]
            : parsePage(froms[0]);
        const toPage = (tos.length === 0)
            ? [...childsParsed].reverse().find(p => p.pages.length > 0)?.pages[0]
            : parsePage(tos[0]);
        if (!fromPage || !toPage)
            throw new Error(`Cannot parse locus for ${froms[0]} and ${tos[0]}!`);

        const fromIdx = childsParsed.findIndex(
            p => p.pages.length > 0 && equalsPages(fromPage, p.pages[0])
                || (p.pages.length === 2 && equalsPages(fromPage, p.pages[1])));
        const toIdx = childsParsed.findIndex(
            p => (p.pages.length > 0 && equalsPages(toPage, p.pages[0]))
                || (p.pages.length === 2 && equalsPages(toPage, p.pages[1]))) + 1;

        if (fromIdx < 0 || toIdx <= 0 || fromIdx >= toIdx || toIdx > childsParsed.length)
            throw new Error(`Cannot find range for ${froms[0]} till ${tos[0]}!`);

        const id = (froms.length > 0 && tos.length > 0)
            ? `${collectionId}_${froms[0]}:${tos[0]}`
            : `${collectionId}_range`;

        const title = getTexts(itemElem, './cmd:Title/cmd:title', true)[0];
        const authors = getTexts(itemElem, './cmd:Author/cmd:author');
        const notes = getTexts(itemElem, './cmd:Note/cmd:note');

        const rangeMetadata: Metadata[] = [];
        addMetadata(rangeMetadata, 'Language',
            getTexts(itemElem, './cmd:TextLang/cmd:textLang')
                .map(lang => languageNames.of(lang)) as string[]);

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
            collection_id: collectionId,
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

function getIdentifier(root: Element): { parentId: string, collectionId: string } {
    const identifier = getTexts(root, './cmd:Source/cmd:Identifier/cmd:Idno/cmd:idno', true);
    const identifierParts = identifier[0].split(' ');
    const parentId = identifierParts[0];
    const collectionId = identifierParts.join('_');

    return {parentId, collectionId};
}

function getTexts(root: Element, xpath: string, required: boolean = false): string[] {
    const elements = root.find<Element>(xpath, ns);
    if (required && elements.length === 0)
        throw new Error(`Missing elements for ${xpath}`);

    return elements.map(el => el.text().trim());
}

function addMetadata(metadata: Metadata[], label: string, value: string | string[]): void {
    value.length > 0 && metadata.push({label, value});
}
