import {Document, Element} from 'libxmljs2';

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

export function getMetadata(collectionId: string, marc: Document): MARCXMLMetadata[] {
    const metadata: MARCXMLMetadata = {title: 'No title'};

    const marcRoot = marc.root();
    if (marcRoot) {
        extractFormat(marcRoot, metadata);
        extractTitle(marcRoot, metadata);
        extractDescription(marcRoot, metadata);
        extractPhysicalDescription(marcRoot, metadata);
        extractAuthors(marcRoot, metadata);
        extractDates(marcRoot, metadata);
        extractHdlToMetadata(marcRoot, metadata);
        extractSignature(marcRoot, collectionId, metadata);

        return [metadata];
    }

    return [];
}

export function getAccess(collectionId: string, marc: Document): string {
    const marc542m = marc.get<Element>('//marc:datafield[@tag="542"]/marc:subfield[@code="m"]', ns);
    if (marc542m)
        return marc542m.text();

    return 'closed';
}

export function getCollectionIds(marc: Document): string[] {
    return marc
        .find<Element>('//marc:datafield[@tag="852"]/marc:subfield[@code="p"]', ns)
        .map(elem => elem.text().trim());
}

function extractFormat(marc: Element, metadata: MARCXMLMetadata): void {
    const marcLeader = marc.get<Element>('//marc:leader', ns) as Element;
    const format = marcLeader.text().trim().substring(6, 8);

    switch (format) {
        case 'ab':
            metadata.format = 'article';
            break;
        case 'aa':
        case 'ar':
        case 'as':
        case 'ps':
        case 'ac':
            metadata.format = 'serial';
            break;
        case 'am':
        case 'pm':
            metadata.format = 'book';
            break;
        case 'im':
        case 'pi':
        case 'ic':
        case 'jm':
        case 'jc':
            metadata.format = 'sound';
            break;
        case 'av':
        case 'rm':
        case 'pv':
        case 'km':
        case 'kc':
        case 'rc':
            metadata.format = 'visual';
            break;
        case 'gm':
        case 'gc':
            metadata.format = 'moving visual';
            break;
        case 'bm':
        case 'do':
        case 'oc':
        case 'pc':
            metadata.format = 'archive';
            break;
    }
}

function extractTitle(marc: Element, metadata: MARCXMLMetadata): void {
    metadata.title = normalize(
        marc.find<Element>('//marc:datafield[@tag="245"]/marc:subfield[@code="a" or @code="b"]', ns)
            .map(titleMarc => titleMarc.text().trim())
    );
}

function extractDescription(marc: Element, metadata: MARCXMLMetadata): void {
    const marc520 = marc.find<Element>('//marc:datafield[@tag="520"]/marc:subfield', ns)
        .map(descrMarc => descrMarc.text().trim());

    if (marc520.length > 0)
        metadata.description = normalize(marc520, false);

    const marc500 = marc.find<Element>('//marc:datafield[@tag="500"]/marc:subfield', ns)
        .map(descrMarc => descrMarc.text().trim());

    if (marc500.length > 0)
        metadata.description = normalize(marc500, false);
}

function extractPhysicalDescription(marc: Element, metadata: MARCXMLMetadata): void {
    const marc300 = marc.find<Element>('//marc:datafield[@tag="300"]/marc:subfield', ns)
        .map(physical => physical.text().trim());

    if (marc300.length > 0)
        metadata.physical = normalize(marc300);
}

function extractAuthors(marc: Element, metadata: MARCXMLMetadata): void {
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
    ].map(({tag, role}) => ({marcAuthors: marc.find<Element>(`//marc:datafield[@tag="${tag}"]`, ns), role}))
        .reduce<{ marcAuthor: Element, role: string }[]>((acc, {marcAuthors, role}) => acc.concat(marcAuthors.map(i => ({
            marcAuthor: i,
            role
        }))), [])
        .filter(({marcAuthor, role}) => marcAuthor.get<Element>('./marc:subfield[@code="a"]', ns))
        .map(({marcAuthor, role}) => {
            let name = normalize((marcAuthor.get<Element>('./marc:subfield[@code="a"]', ns) as Element).text().trim());

            const bElem = marcAuthor.get<Element>('./marc:subfield[@code="b"]', ns);
            if (bElem)
                name = name + ' ' + normalize(bElem.text().trim());

            const cElem = marcAuthor.get<Element>('./marc:subfield[@code="c"]', ns);
            if (cElem)
                name = name + ' ' + normalize(cElem.text().trim());

            const dElem = marcAuthor.get<Element>('./marc:subfield[@code="d"]', ns);
            if (dElem)
                name = name + ' ' + normalize(dElem.text().trim());

            const marcAuthorsType = marcAuthor.get<Element>('./marc:subfield[@code="e"]', ns);

            return {type: marcAuthorsType ? normalize(marcAuthorsType.text().trim()) : role, name};
        });

    if (authors.length > 0)
        metadata.authors = authors;
}

function extractDates(marc: Element, metadata: MARCXMLMetadata): void {
    const dates = marc.find<Element>('//marc:datafield[@tag="260" or @tag="264"]/marc:subfield[@code="c"]', ns)
        .map(marcDates => normalize(marcDates.text().trim()));

    if (dates.length > 0)
        metadata.dates = dates;
}

function extractHdlToMetadata(marc: Element, metadata: MARCXMLMetadata): void {
    const metadataHdl = marc.get<Element>('//marc:datafield[@tag="902"]', ns);
    if (metadataHdl)
        metadata.metadataHdl = metadataHdl.text().trim();
}

function extractSignature(marc: Element, collectionId: string, metadata: MARCXMLMetadata): void {
    const marc852 = marc.find<Element>('//marc:datafield[@tag="852"]', ns).find(marc852 => {
        const marc852p = marc852.get<Element>('./marc:subfield[@code="p"]', ns);
        return marc852p && marc852p.text().trim() === collectionId;
    });

    if (marc852) {
        const marc852c = marc852.get<Element>('./marc:subfield[@code="c"]', ns);
        const marc852j = marc852.get<Element>('./marc:subfield[@code="j"]', ns);

        metadata.signature = `${marc852c ? marc852c.text().trim() : ''} ${marc852j ? marc852j.text().trim() : ''}`.trim();
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
