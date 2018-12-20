const libxmljs = require('libxmljs');

const ns = {'marc': 'http://www.loc.gov/MARC21/slim'};

function getMetadata(collectionId, marcXml) {
    const marc = libxmljs.parseXml(marcXml);
    const metadata = {};

    extractTitle(marc, metadata);
    extractDescription(marc, metadata);
    extractPhysicalDescription(marc, metadata);
    extractAuthors(marc, metadata);
    extractDates(marc, metadata);
    extractHdlToMetadata(marc, metadata);

    return [metadata];
}

function getAccess(collectionId, marcXml) {
    const marc = libxmljs.parseXml(marcXml);

    const marc542m = marc.get('//marc:datafield[@tag="542"]/marc:subfield[@code="m"]', ns);
    if (marc542m)
        return marc542m.text();

    return 'open'; // TODO: Always open or always closed (depending on type?)
}

function extractTitle(marc, metadata) {
    metadata['title'] = normalize(
        marc.find('//marc:datafield[@tag="245"]/marc:subfield[@code="a" or @code="b"]', ns)
            .map(titleMarc => titleMarc.text().trim())
    );
}

function extractDescription(marc, metadata) {
    const marc520 = marc
        .find('//marc:datafield[@tag="520"]/marc:subfield', ns)
        .map(descrMarc => descrMarc.text().trim());

    if (marc520.length > 0)
        metadata['description'] = normalize(marc520);

    const marc500 = marc
        .find('//marc:datafield[@tag="500"]/marc:subfield', ns)
        .map(descrMarc => descrMarc.text().trim());

    if (marc500.length > 0)
        metadata['description'] = normalize(marc500);
}

function extractPhysicalDescription(marc, metadata) {
    const marc300 = marc
        .find('//marc:datafield[@tag="300"]/marc:subfield', ns)
        .map(physical => physical.text().trim());

    if (marc300.length > 0)
        metadata['physical'] = normalize(marc300);
}

function extractAuthors(marc, metadata) {
    const authors = [
        {tag: 100, defaultRole: 'Author'},
        {tag: 110, defaultRole: 'Organization'},
        {tag: 111, defaultRole: 'Congress'},
        {tag: 600, defaultRole: 'Subject person'},
        {tag: 610, defaultRole: 'Subject corporation'},
        {tag: 611, defaultRole: 'Subject congress'},
        {tag: 700, defaultRole: 'Other author'},
        {tag: 710, defaultRole: 'Other organization'},
        {tag: 711, defaultRole: 'Other congress'}
    ].map(({tag, defaultRole}) => ({marcAuthor: marc.find(`//marc:datafield[@tag="${tag}"`, ns), defaultRole}))
        .filter(({marcAuthor, defaultRole}) => marcAuthor)
        .map(({marcAuthor, defaultRole}) => {
            let name = normalize(marcAuthor.get('./marc:subfield[@code="a"]', ns).text().trim());
            if (marcAuthor.get('./marc:subfield[@code="b"]', ns))
                name = name + ' ' + normalize(marcAuthor.get('./marc:subfield[@code="b"]', ns).text().trim());

            if (marcAuthor.get('./marc:subfield[@code="c"]', ns))
                name = name + ' ' + normalize(marcAuthor.get('./marc:subfield[@code="c"]', ns).text().trim());

            if (marcAuthor.get('./marc:subfield[@code="d"]', ns))
                name = name + ' ' + normalize(marcAuthor.get('./marc:subfield[@code="d"]', ns).text().trim());

            const marcAuthorsType = marcAuthor.get('./marc:subfield[@code="e"]', ns);

            return {type: marcAuthorsType ? normalize(marcAuthorsType.text().trim()) : defaultRole, name};
        });

    if (authors.length > 0)
        metadata['authors'] = authors;
}

function extractDates(marc, metadata) {
    const dates = marc.find('//marc:datafield[@tag="260" or @tag="264"]/marc:subfield[@code="c"]', ns).map(marcDates => {
        return normalize(marcDates.text().trim());
    });

    if (dates.length > 0)
        metadata['dates'] = dates;
}

function extractHdlToMetadata(marc, metadata) {
    metadata['metadataHdl'] = marc.get('//marc:datafield[@tag="902"]', ns).text().trim();
}

function normalize(value) {
    if (Array.isArray(value))
        return value.map(val => normalize(val)).join(' ');

    if (value.endsWith('.'))
        value = value.slice(0, value.length - 1).trim();

    if (value.endsWith('/'))
        value = value.slice(0, value.length - 1).trim();

    return value.charAt(0).toUpperCase() + value.slice(1);
}

module.exports = {getMetadata, getAccess};
