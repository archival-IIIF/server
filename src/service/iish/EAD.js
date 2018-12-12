const crypto = require('crypto');
const libxmljs = require('libxmljs');

const ns = {'ead': 'urn:isbn:1-931666-22-9'};

function getMetadata(collectionId, eadXml) {
    const [id, unitId] = collectionId.split('.');
    const ead = libxmljs.parseXml(eadXml);

    const archdesc = ead.get('//ead:ead/ead:archdesc', ns);

    return [
        getMetadataFromLevel(archdesc),
        ...walkThroughLevels(archdesc.get(`.//ead:unitid[text()="${unitId}"]/../..`, ns))
    ];
}

function getAccess(collectionId, eadXml) {
    const [id, unitId] = collectionId.split('.');
    const ead = libxmljs.parseXml(eadXml);

    const accessRestrict = ead
        .get('//ead:ead/ead:archdesc/ead:descgrp[@type="access_and_use"]/ead:accessrestrict', ns);
    const accessType = accessRestrict.attr('type');

    let restriction = accessRestrict.get('./ead:p', ns).text().toLowerCase().trim();
    if (accessType && (accessType.value() === 'part')) {
        const itemAccessRestrict = ead
            .get(`//ead:ead/ead:archdesc//ead:unitid[text()="${unitId}"]/../../ead:accessrestrict`,
                ns);

        if (itemAccessRestrict)
            restriction = itemAccessRestrict.attr('type').value();
        else
            restriction = 'open';
    }

    switch (restriction) {
        case 'gesloten':
        case 'closed':
            return 'closed';
        case 'beperkt':
        case 'restricted':
            return 'eadRestricted';
        case 'date':
            return 'date';
        default:
            return 'open';
    }
}

function walkThroughLevels(level) {
    if (!level)
        return [];

    const parent = level.get('.//preceding-sibling::ead:did/..', ns);
    if (parent.name() !== level.name())
        return [
            ...walkThroughLevels(parent),
            getMetadataFromLevel(level)
        ];

    return [getMetadataFromLevel(level)];
}

function getMetadataFromLevel(level) {
    const metadata = {};

    if (!level)
        return metadata;

    metadata['title'] = level.get('./ead:did/ead:unittitle', ns).text().trim();

    const unitId = level.get('./ead:did/ead:unitid', ns);
    metadata['unitId'] = unitId
        ? unitId.text().trim()
        : crypto.createHash('md5').update(metadata.title).digest('hex');

    const dates = level.find('./ead:did//ead:unitdate', ns).map(date => date.text().trim());
    if (dates.length > 0)
        metadata['dates'] = dates;

    const origination = level.find('./ead:did//ead:origination', ns).map(origin => {
        const type = origin.attr('label');
        return {type: type ? type.value() : 'Author', name: origin.text().trim()};
    });
    if (origination.length > 0)
        metadata['authors'] = origination;

    const extent = level.get('./ead:did/ead:physdesc//ead:extent', ns);
    if (extent)
        metadata['extent'] = extent.text().trim();

    const content = level.find('./ead:descgrp[@type="content_and_structure"]/ead:scopecontent/ead:p', ns);
    if (content.length > 0)
        metadata['content'] = content
            .reduce((acc, p) => [...acc, p.text().trim()], [])
            .join('<br/>');

    return metadata;
}

module.exports = {getMetadata, getAccess};
