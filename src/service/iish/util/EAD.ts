import {createHash} from 'node:crypto';
import {XmlDocument, XmlNode} from 'libxml2-wasm';

export interface EADMetadata {
    formats: string[];
    title: string;
    unitId?: string;
    unitIdIsInventoryNumber: boolean;
    order?: number;
    content?: string;
    extent?: string;
    authors?: { type: string, name: string }[];
    dates?: string[];
    eadTitle?: string;
}

const ns = {'ead': 'urn:isbn:1-931666-22-9'};

export const EAD_OAI_PREFIX = 'oai:socialhistoryservices.org:10622/';

export function getRootId(collectionId: string): string {
    return collectionId.split('.')[0];
}

export function getUnitId(collectionId: string): string {
    const collectionIdSplit = collectionId.split('.');
    collectionIdSplit.shift();

    return collectionIdSplit.join('.');
}

export function getMetadata(collectionId: string, ead: XmlDocument): EADMetadata[] {
    const archdesc = ead.get('//ead:ead/ead:archdesc', ns);
    if (archdesc) {
        const unitId = getUnitId(collectionId);
        const metadata = extractMetadataFromLevel(archdesc);

        return [
            metadata,
            ...walkThroughLevels(archdesc.get(`.//ead:unitid[normalize-space()="${unitId}"]/../..`, ns), metadata)
        ];
    }

    return [];
}

export function getAccess(collectionId: string, ead: XmlDocument): string {
    let restriction: string | null = null;
    const accessRestrict = ead.get('//ead:ead/ead:archdesc/ead:descgrp[@type="access_and_use"]/ead:accessrestrict|//ead:ead/ead:archdesc/ead:accessrestrict', ns);
    if (accessRestrict) {
        const accessValue = accessRestrict.get('./ead:p', ns);
        if (accessValue)
            restriction = accessValue.content.toLowerCase().trim();

        const unitId = getUnitId(collectionId);
        const accessType = accessRestrict.get('@type')?.content;
        if (accessType === 'part') {
            const itemAccessRestrict = ead.get(`//ead:ead/ead:archdesc//ead:unitid[normalize-space()="${unitId}"]/../../ead:accessrestrict`, ns);

            if (itemAccessRestrict)
                restriction = itemAccessRestrict.get('@type')?.content || 'open';
            else
                restriction = 'open';
        }
    }

    switch (restriction) {
        case 'gesloten':
        case 'closed':
            return 'closed';
        case 'beperkt':
        case 'restricted':
            return 'restricted';
        case 'date':
            return 'date';
        default:
            return 'open';
    }
}

function walkThroughLevels(level: XmlNode | null, parentMetadata: EADMetadata): EADMetadata[] {
    if (!level)
        return [];

    const metadata = extractMetadataFromLevel(level, parentMetadata);
    const parent = level.get('.//preceding-sibling::ead:did/..', ns);
    if (parent) {
        const parentName = (parent as unknown as { name: string }).name;
        const levelName = (level as unknown as { name: string }).name;
        if (parentName !== levelName)
            return [...walkThroughLevels(parent, metadata), metadata];
    }

    return [metadata];
}

function extractMetadataFromLevel(level: XmlNode | null, parentMetadata: EADMetadata | null = null): EADMetadata {
    const metadata: EADMetadata = {formats: [], title: 'No title', unitIdIsInventoryNumber: true};
    if (!level)
        return metadata;

    extractFormats(level, metadata, parentMetadata);
    extractTitle(level, metadata);
    extractUnitId(level, metadata, parentMetadata);
    extractOrder(level, metadata);
    extractContent(level, metadata);
    extractExtent(level, metadata);
    extractAuthors(level, metadata);
    extractDates(level, metadata);
    extractEadTitle(metadata, parentMetadata);

    return metadata;
}

function extractFormats(ead: XmlNode, metadata: EADMetadata, parentMetadata: EADMetadata | null): void {
    const formatElems = ead.find('./ead:descgrp[@type="content_and_structure"]/' +
        'ead:controlaccess/ead:controlaccess/ead:genreform|ead:controlaccess/ead:genreform', ns);

    const formats = formatElems.map(formatElem => {
        const format = formatElem.content.toLowerCase();

        if (format.includes('article'))
            return 'article';

        if (format.includes('serial'))
            return 'serial';

        if (format.includes('book'))
            return 'book';

        if (format.includes('sound'))
            return 'sound';

        if (format.includes('visual') || format.includes('photo') || format.includes('poster')
            || format.includes('drawing') || format.includes('object'))
            return 'visual';

        if (format.includes('moving'))
            return 'moving visual';

        return 'archive';
    });

    if (formats.length === 0 && parentMetadata)
        metadata.formats = parentMetadata.formats;
    else
        metadata.formats = [...new Set(formats)];
}

function extractTitle(ead: XmlNode, metadata: EADMetadata): void {
    const title = ead.get('./ead:did/ead:unittitle', ns);
    if (title)
        metadata.title = title.content.trim();
}

function extractUnitId(ead: XmlNode, metadata: EADMetadata, parentMetadata: EADMetadata | null): void {
    if (metadata.title) {
        const unitId = ead.get('./ead:did/ead:unitid', ns);
        metadata.unitIdIsInventoryNumber = !!unitId && parentMetadata !== null;
        metadata.unitId = unitId ? unitId.content.trim() : createHash('md5').update(metadata.title).digest('hex');
    }
}

function extractOrder(ead: XmlNode, metadata: EADMetadata): void {
    metadata.order = ead.find('./preceding-sibling::*', ns).length;
}

function extractContent(ead: XmlNode, metadata: EADMetadata): void {
    const content = ead.find('./ead:descgrp[@type="content_and_structure"]/ead:scopecontent/ead:p|./ead:scopecontent/ead:p', ns);

    if (content.length > 0)
        metadata.content = content
            .reduce<string[]>((acc, p) => [...acc, p.content.trim()], [])
            .join('<br/>');
}

function extractExtent(ead: XmlNode, metadata: EADMetadata): void {
    const extent = ead.get('./ead:did/ead:physdesc//ead:extent', ns);
    if (extent)
        metadata.extent = extent.content.trim();
}

function extractAuthors(ead: XmlNode, metadata: EADMetadata): void {
    const origination = ead.find('./ead:did//ead:origination', ns).map(origin => {
        const type = origin.get('@label')?.content;
        return {type: type || 'Author', name: origin.content.trim()};
    });

    if (origination.length > 0)
        metadata.authors = origination;
}

function extractDates(ead: XmlNode, metadata: EADMetadata): void {
    const dates = ead.find('./ead:did//ead:unitdate', ns).map(date => date.content.trim());
    if (dates.length > 0)
        metadata.dates = dates;
}

function extractEadTitle(metadata: EADMetadata, parentMetadata: EADMetadata | null): void {
    if (parentMetadata)
        metadata.eadTitle = parentMetadata.eadTitle || parentMetadata.title;
}
