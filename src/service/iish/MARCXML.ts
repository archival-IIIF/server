import * as libxmljs from 'libxmljs';
import {Element} from 'libxmljs';

export interface MARCXMLMetadata {
    title?: string;
    description?: string;
    physical?: string;
    authors?: { type: string, name: string }[];
    dates?: string[];
    metadataHdl?: string;
}

const ns = {'marc': 'http://www.loc.gov/MARC21/slim'};

export function getMetadata(collectionId: string, marcXml: string): MARCXMLMetadata[] {
    const marc = libxmljs.parseXml(marcXml).root();
    const metadata: MARCXMLMetadata = {};

    if (marc) {
        extractTitle(marc, metadata);
        extractDescription(marc, metadata);
        extractPhysicalDescription(marc, metadata);
        extractAuthors(marc, metadata);
        extractDates(marc, metadata);
        extractHdlToMetadata(marc, metadata);

        return [metadata];
    }

    return [];
}

export function getAccess(collectionId: string, marcXml: string): string {
    const marc = libxmljs.parseXml(marcXml);

    const marc542m = marc.get('//marc:datafield[@tag="542"]/marc:subfield[@code="m"]', ns);
    if (marc542m)
        return marc542m.text();

    return 'open'; // TODO: Always open or always closed (depending on type?)
}

function extractTitle(marc: Element, metadata: MARCXMLMetadata): void {
    metadata['title'] = normalize(
        (marc.find('//marc:datafield[@tag="245"]/marc:subfield[@code="a" or @code="b"]', ns) as Element[])
            .map(titleMarc => titleMarc.text().trim())
    );
}

function extractDescription(marc: Element, metadata: MARCXMLMetadata): void {
    const marc520 = (marc.find('//marc:datafield[@tag="520"]/marc:subfield', ns) as Element[])
        .map(descrMarc => descrMarc.text().trim());

    if (marc520.length > 0)
        metadata['description'] = normalize(marc520);

    const marc500 = (marc.find('//marc:datafield[@tag="500"]/marc:subfield', ns) as Element[])
        .map(descrMarc => descrMarc.text().trim());

    if (marc500.length > 0)
        metadata['description'] = normalize(marc500);
}

function extractPhysicalDescription(marc: Element, metadata: MARCXMLMetadata): void {
    const marc300 = (marc.find('//marc:datafield[@tag="300"]/marc:subfield', ns) as Element[])
        .map(physical => physical.text().trim());

    if (marc300.length > 0)
        metadata['physical'] = normalize(marc300);
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
    ].map(({tag, role}) => ({marcAuthors: marc.find(`//marc:datafield[@tag="${tag}"]`, ns) as Element[], role}))
        .reduce<{ marcAuthor: Element, role: string }[]>((acc, {marcAuthors, role}) => acc.concat(marcAuthors.map(i => ({
            marcAuthor: i,
            role
        }))), [])
        .map(({marcAuthor, role}) => {
            let name = normalize((marcAuthor.get('./marc:subfield[@code="a"]', ns) as Element).text().trim());

            const bElem = marcAuthor.get('./marc:subfield[@code="b"]', ns);
            if (bElem)
                name = name + ' ' + normalize(bElem.text().trim());

            const cElem = marcAuthor.get('./marc:subfield[@code="b"]', ns);
            if (cElem)
                name = name + ' ' + normalize(cElem.text().trim());

            const dElem = marcAuthor.get('./marc:subfield[@code="b"]', ns);
            if (dElem)
                name = name + ' ' + normalize(dElem.text().trim());

            const marcAuthorsType = marcAuthor.get('./marc:subfield[@code="e"]', ns);

            return {type: marcAuthorsType ? normalize(marcAuthorsType.text().trim()) : role, name};
        });

    if (authors.length > 0)
        metadata['authors'] = authors;
}

function extractDates(marc: Element, metadata: MARCXMLMetadata): void {
    const dates = (marc.find('//marc:datafield[@tag="260" or @tag="264"]/marc:subfield[@code="c"]', ns) as Element[])
        .map(marcDates => normalize(marcDates.text().trim()));

    if (dates.length > 0)
        metadata['dates'] = dates;
}

function extractHdlToMetadata(marc: Element, metadata: MARCXMLMetadata): void {
    const metadataHdl = marc.get('//marc:datafield[@tag="902"]', ns);
    if (metadataHdl)
        metadata['metadataHdl'] = metadataHdl.text().trim();
}

function normalize(value: string | string[]): string {
    if (Array.isArray(value))
        return value.map(val => normalize(val)).join(' ');

    if (value.endsWith('.'))
        value = value.slice(0, value.length - 1).trim();

    if (value.endsWith('/'))
        value = value.slice(0, value.length - 1).trim();

    return value.charAt(0).toUpperCase() + value.slice(1);
}
