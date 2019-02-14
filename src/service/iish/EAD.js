const crypto = require('crypto');
const libxmljs = require('libxmljs');

const ns = {'ead': 'urn:isbn:1-931666-22-9'};

function getMetadata(collectionId, eadXml) {
    const [id, unitId] = collectionId.split('.');
    const ead = libxmljs.parseXml(eadXml);

    const archdesc = ead.get('//ead:ead/ead:archdesc', ns);

    return [
        extractMetadataFromLevel(archdesc),
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
    if (parent && parent.name() !== level.name())
        return [
            ...walkThroughLevels(parent),
            extractMetadataFromLevel(level)
        ];

    return [extractMetadataFromLevel(level)];
}

function extractMetadataFromLevel(level) {
    const metadata = {};
    if (!level)
        return metadata;

    extractTitle(level, metadata);
    extractUnitId(level, metadata);
    extractContent(level, metadata);
    extractExtent(level, metadata);
    extractAuthors(level, metadata);
    extractDates(level, metadata);

    return metadata;
}

function extractTitle(ead, metadata) {
    metadata['title'] = ead.get('./ead:did/ead:unittitle', ns).text().trim();
}

function extractUnitId(ead, metadata) {
    const unitId = ead.get('./ead:did/ead:unitid', ns);
    metadata['unitId'] = unitId
        ? unitId.text().trim()
        : crypto.createHash('md5').update(metadata.title).digest('hex');
}

function extractContent(ead, metadata) {
    const content = ead.find('./ead:descgrp[@type="content_and_structure"]/ead:scopecontent/ead:p', ns);

    if (content.length > 0)
        metadata['content'] = content
            .reduce((acc, p) => [...acc, p.text().trim()], [])
            .join('<br/>');
}

function extractExtent(ead, metadata) {
    const extent = ead.get('./ead:did/ead:physdesc//ead:extent', ns);

    if (extent)
        metadata['extent'] = extent.text().trim();
}

function extractAuthors(ead, metadata) {
    const origination = ead.find('./ead:did//ead:origination', ns).map(origin => {
        const type = origin.attr('label');
        return {type: type ? type.value() : 'Author', name: origin.text().trim()};
    });

    if (origination.length > 0)
        metadata['authors'] = origination;
}

function extractDates(ead, metadata) {
    const dates = ead.find('./ead:did//ead:unitdate', ns).map(date => date.text().trim());
    if (dates.length > 0)
        metadata['dates'] = dates;
}

module.exports = {getMetadata, getAccess};
