import {XmlDocument, XmlNode} from 'libxml2-wasm';

export interface MARCXMLMetadata {
    format?: string;
    title: string;
    description?: string;
    physical?: string;
    authors?: { type: string, name: string }[];
    dates?: string[];
    metadataHdl?: string;
    signature?: string;
}

const ns = {'marc': 'http://www.loc.gov/MARC21/slim'};

export const MARC_OAI_PREFIX = 'oai:socialhistoryservices.org:';

export function getMetadata(collectionId: string, marc: XmlDocument): MARCXMLMetadata[] {
    const metadata: MARCXMLMetadata = {title: 'No title'};

    extractFormat(marc, metadata);
    extractTitle(marc, metadata);
    extractDescription(marc, metadata);
    extractPhysicalDescription(marc, metadata);
    extractAuthors(marc, metadata);
    extractDates(marc, metadata);
    extractHdlToMetadata(marc, metadata);
    extractSignature(marc, collectionId, metadata);

    return [metadata];
}

export function getAccess(marc: XmlDocument): string {
    const marc542m = marc.get('//marc:datafield[@tag="542"]/marc:subfield[@code="m"]', ns);
    if (marc542m)
        return marc542m.content;

    return 'closed';
}

export function getCollectionIds(marc: XmlDocument): string[] {
    return marc
        .find('//marc:datafield[@tag="852"]/marc:subfield[@code="p"]', ns)
        .map(elem => elem.content.trim());
}

export function getId(marc: XmlDocument): string | undefined {
    return marc.get('//marc:controlfield[@tag="001"]', ns)?.content;
}

export function getFormat(marcLeader: string): string | null {
    switch (marcLeader.trim().substring(6, 8)) {
        case 'ab':
            return 'article';
        case 'aa':
        case 'ar':
        case 'as':
        case 'ps':
        case 'ac':
            return 'serial';
        case 'am':
        case 'pm':
            return 'book';
        case 'im':
        case 'pi':
        case 'ic':
        case 'jm':
        case 'jc':
            return 'sound';
        case 'av':
        case 'rm':
        case 'pv':
        case 'km':
        case 'kc':
        case 'rc':
            return 'visual';
        case 'gm':
        case 'gc':
            return 'moving visual';
        case 'bm':
        case 'do':
        case 'oc':
        case 'pc':
            return 'archive';
        default:
            return null;
    }
}

function extractId(marc: XmlNode, metadata: MARCXMLMetadata): void {
    const marcLeader = marc.get('//marc:leader', ns) as XmlNode;
    const format = getFormat(marcLeader.content);
    if (format)
        metadata.format = format;
}

function extractFormat(marc: XmlDocument, metadata: MARCXMLMetadata): void {
    const marcLeader = marc.get('//marc:leader', ns) as XmlNode;
    const format = getFormat(marcLeader.content);
    if (format)
        metadata.format = format;
}

function extractTitle(marc: XmlDocument, metadata: MARCXMLMetadata): void {
    metadata.title = normalize(
        marc.find('//marc:datafield[@tag="245"]/marc:subfield[@code="a" or @code="b"]', ns)
            .map(titleMarc => titleMarc.content.trim())
    );
}

function extractDescription(marc: XmlDocument, metadata: MARCXMLMetadata): void {
    const marc520 = marc.find('//marc:datafield[@tag="520"]/marc:subfield', ns)
        .map(descrMarc => descrMarc.content.trim());

    if (marc520.length > 0)
        metadata.description = normalize(marc520, false);

    const marc500 = marc.find('//marc:datafield[@tag="500"]/marc:subfield', ns)
        .map(descrMarc => descrMarc.content.trim());

    if (marc500.length > 0)
        metadata.description = normalize(marc500, false);
}

function extractPhysicalDescription(marc: XmlDocument, metadata: MARCXMLMetadata): void {
    const marc300 = marc.find('//marc:datafield[@tag="300"]/marc:subfield', ns)
        .map(physical => physical.content.trim());

    if (marc300.length > 0)
        metadata.physical = normalize(marc300);
}

function extractAuthors(marc: XmlDocument, metadata: MARCXMLMetadata): void {
    const authors = [
        {tag: 100, role: 'Author'},
        {tag: 110, role: 'Organization'},
        {tag: 111, role: 'Congress'},
        {tag: 600, role: 'Subject person'},
        {tag: 610, role: 'Subject corporation'},
        {tag: 611, role: 'Subject congress'},
        {tag: 700, role: 'Other author'},
        {tag: 710, role: 'Other organization'},
        {tag: 711, role: 'Other congress'}
    ].map(({tag, role}) => ({marcAuthors: marc.find(`//marc:datafield[@tag="${tag}"]`, ns), role}))
        .reduce<{ marcAuthor: XmlNode, role: string }[]>((acc, {
            marcAuthors,
            role
        }) => acc.concat(marcAuthors.map(i => ({
            marcAuthor: i,
            role
        }))), [])
        .filter(({marcAuthor, role}) => marcAuthor.get('./marc:subfield[@code="a"]', ns))
        .map(({marcAuthor, role}) => {
            let name = normalize((marcAuthor.get('./marc:subfield[@code="a"]', ns) as XmlNode).content.trim());

            const bElem = marcAuthor.get('./marc:subfield[@code="b"]', ns);
            if (bElem)
                name = name + ' ' + normalize(bElem.content.trim());

            const cElem = marcAuthor.get('./marc:subfield[@code="c"]', ns);
            if (cElem)
                name = name + ' ' + normalize(cElem.content.trim());

            const dElem = marcAuthor.get('./marc:subfield[@code="d"]', ns);
            if (dElem)
                name = name + ' ' + normalize(dElem.content.trim());

            const marcAuthorsType = marcAuthor.get('./marc:subfield[@code="e"]', ns);

            return {type: marcAuthorsType ? normalize(marcAuthorsType.content.trim()) : role, name};
        });

    if (authors.length > 0)
        metadata.authors = authors;
}

function extractDates(marc: XmlDocument, metadata: MARCXMLMetadata): void {
    const dates = marc.find('//marc:datafield[@tag="260" or @tag="264"]/marc:subfield[@code="c"]', ns)
        .map(marcDates => normalize(marcDates.content.trim()));

    if (dates.length > 0)
        metadata.dates = dates;
}

function extractHdlToMetadata(marc: XmlDocument, metadata: MARCXMLMetadata): void {
    const metadataHdl = marc.get('//marc:datafield[@tag="902"]', ns);
    if (metadataHdl)
        metadata.metadataHdl = metadataHdl.content.trim();
}

function extractSignature(marc: XmlDocument, collectionId: string, metadata: MARCXMLMetadata): void {
    const marc852 = marc.find('//marc:datafield[@tag="852"]', ns).find(marc852 => {
        const marc852p = marc852.get('./marc:subfield[@code="p"]', ns);
        return marc852p && marc852p.content.trim() === collectionId;
    });

    if (marc852) {
        const marc852c = marc852.get('./marc:subfield[@code="c"]', ns);
        const marc852j = marc852.get('./marc:subfield[@code="j"]', ns);

        metadata.signature = `${marc852c ? marc852c.content.trim() : ''} ${marc852j ? marc852j.content.trim() : ''}`.trim();
    }
}

function normalize(value: string | string[], removePeriod: boolean = true): string {
    if (Array.isArray(value))
        return value.map(val => normalize(val, removePeriod)).join(' ');

    if (value.endsWith('.') && removePeriod)
        value = value.slice(0, value.length - 1).trim();

    if (value.endsWith('/'))
        value = value.slice(0, value.length - 1).trim();

    return value.charAt(0).toUpperCase() + value.slice(1);
}
