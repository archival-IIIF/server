const crypto = require('crypto');
const libxmljs = require('libxmljs');

const namespaces = {
    'ead': 'urn:isbn:1-931666-22-9'
};

function getMetadata(collectionId, eadXml) {
    const [id, unitId] = collectionId.split('.');
    const ead = libxmljs.parseXml(eadXml);

    const archdesc = ead.get('//ead:ead/ead:archdesc', namespaces);

    return [
        getMetadataFromLevel(archdesc),
        ...walkThroughLevels(archdesc.get(`.//ead:unitid[text()="${unitId}"]/../..`, namespaces))
    ];
}

function getAccess(collectionId, eadXml) {
    const [id, unitId] = collectionId.split('.');
    const ead = libxmljs.parseXml(eadXml);

    const accessRestrict = ead
        .get('//ead:ead/ead:archdesc/ead:descgrp[@type="access_and_use"]/ead:accessrestrict', namespaces);
    const accessType = accessRestrict.attr('type');

    let restriction = accessRestrict.get('./ead:p', namespaces).text().toLowerCase().trim();
    if (accessType && (accessType.value() === 'part')) {
        const itemAccessRestrict = ead
            .get(`//ead:ead/ead:archdesc//ead:unitid[text()="${unitId}"]/../../ead:accessrestrict`,
                namespaces);

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
            return 'restricted';
        case 'date':
            return 'date';
        default:
            return 'open';
    }
}

function walkThroughLevels(level) {
    if (!level)
        return [];

    const parent = level.get('.//preceding-sibling::ead:did/..', namespaces);
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

    metadata['title'] = level.get('./ead:did/ead:unittitle', namespaces).text().trim();

    const unitId = level.get('./ead:did/ead:unitid', namespaces);
    metadata['unitId'] = unitId
        ? unitId.text().trim()
        : crypto.createHash('md5').update(metadata.title).digest('hex');

    const dates = level.find('./ead:did//ead:unitdate', namespaces);
    if (dates.length > 0)
        metadata['date'] = dates.map(date => date.text().trim());

    const origination = level.find('./ead:did//ead:origination', namespaces);
    if (origination.length > 0)
        metadata['authors'] = origination.map(origin => {
            return {type: origin.attr('label').value(), name: origin.text().trim()};
        });

    const extent = level.find('./ead:did/ead:physdesc//ead:extent', namespaces);
    if (extent.length > 0)
        metadata['extent'] = extent.map(name => name.text().trim());

    const language = level.find('./ead:did/ead:langmaterial//ead:language', namespaces);
    if (language.length > 0)
        metadata['language'] = language.map(name => name.attr('langcode').value());

    const content = level.find('./ead:descgrp[@type="content_and_structure"]/ead:scopecontent/ead:p', namespaces);
    if (content.length > 0)
        metadata['content'] = content
            .reduce((acc, p) => [...acc, p.text().trim()], [])
            .join('<br/>');

    return metadata;
}

module.exports = {getMetadata, getAccess};
