const libxmljs = require('libxmljs');

const ns = {'marc': 'http://www.loc.gov/MARC21/slim'};

function getMetadata(collectionId, marcXml) {
    const marc = libxmljs.parseXml(marcXml);

    const metadata = {};

    metadata['title'] = normalize(
        marc.find('//marc:datafield[@tag="245"]/marc:subfield', ns).map(titleMarc => titleMarc.text().trim())
    );

    const marc500 = marc
        .find('//marc:datafield[@tag="500"]/marc:subfield', ns)
        .map(descrMarc => descrMarc.text().trim());
    if (marc500.length > 0)
        metadata['description'] = normalize(marc500);

    const marc520 = marc
        .find('//marc:datafield[@tag="520"]/marc:subfield', ns)
        .map(descrMarc => descrMarc.text().trim());
    if (marc520.length > 0)
        metadata['description'] = normalize(marc520);

    const marc300 = marc
        .find('//marc:datafield[@tag="300"]/marc:subfield', ns)
        .map(physical => physical.text().trim());
    if (marc300.length > 0)
        metadata['physical'] = normalize(marc300);

    const authors = marc
        .find('//marc:datafield[@tag="100" or @tag="110" or @tag="111" or @tag="700" or @tag="710" or @tag="711"]', ns)
        .map(marcAuthors => {
            let name = normalize(marcAuthors.get('./marc:subfield[@code="a"]', ns).text().trim());
            if (marcAuthors.get('./marc:subfield[@code="b"]', ns))
                name = name + ' ' + normalize(marcAuthors.get('./marc:subfield[@code="b"]', ns).text().trim());

            if (marcAuthors.get('./marc:subfield[@code="c"]', ns))
                name = name + ' ' + normalize(marcAuthors.get('./marc:subfield[@code="c"]', ns).text().trim());

            if (marcAuthors.get('./marc:subfield[@code="d"]', ns))
                name = name + ' ' + normalize(marcAuthors.get('./marc:subfield[@code="d"]', ns).text().trim());

            const marcAuthorsType = marcAuthors.get('./marc:subfield[@code="e"]', ns);

            return {type: marcAuthorsType ? normalize(marcAuthorsType.text().trim()) : 'Author', name};
        });
    if (authors.length > 0)
        metadata['authors'] = authors;

    const dates = marc.find('//marc:datafield[@tag="260" or @tag="264"]/marc:subfield[@code="c"]', ns).map(marcDates => {
        return normalize(marcDates.text().trim());
    });
    if (dates.length > 0)
        metadata['dates'] = dates;

    metadata['metadataHdl'] = marc.get('//marc:datafield[@tag="902"]', ns).text().trim();

    return [metadata];
}

function getAccess(collectionId, marcXml) {
    const marc = libxmljs.parseXml(marcXml);

    const marc542m = marc.get('//marc:datafield[@tag="542"]/marc:subfield[@code="m"]', ns);
    if (marc542m)
        return marc542m.text();

    return 'open'; // TODO: Always open or always closed (depending on type?)
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
