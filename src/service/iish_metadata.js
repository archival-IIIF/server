const libxmljs = require('libxmljs');
const request = require('request-promise-native');
const EAD = require('./iish/EAD');
const config = require('../lib/Config');
const {updateItems, getCollectionsByMetadataId} = require('../lib/Item');

const ns = {
    'marc': 'http://www.loc.gov/MARC21/slim'
};

async function processMetadata({oaiIdentifier, collectionId}) {
    if (!oaiIdentifier && collectionId) {
        if (collectionId.includes('ARCH') || collectionId.includes('COLL')) {
            const rootId = collectionId.split('.')[0];
            oaiIdentifier = `oai:socialhistoryservices.org:10622/${rootId}`;
        }
        else {
            const response = await request({
                uri: config.metadataSrwUrl, strictSSL: false, qs: {
                    operation: 'searchRetrieve',
                    query: `marc.852$p="${collectionId}"`
                }
            });

            const srwResults = libxmljs.parseXml(response);
            const marcId = srwResults.get('//marc:controlfield[@tag="001"]', ns).text();
            oaiIdentifier = `oai:socialhistoryservices.org:${marcId}`;
        }
    }

    if (oaiIdentifier)
        await updateWithIdentifier(oaiIdentifier, collectionId);
}

async function updateWithIdentifier(oaiIdentifier, collectionId) {
    const metadataPrefix = (oaiIdentifier.includes('ARCH') || oaiIdentifier.includes('COLL')) ? 'ead' : 'marcxml';
    const xml = await request({
        uri: config.metadataOaiUrl, strictSSL: false, qs: {
            verb: 'GetRecord',
            identifier: oaiIdentifier,
            metadataPrefix
        }
    });

    const allMetadata = [];

    const collections = await getCollectionsByMetadataId(oaiIdentifier);
    if (collectionId && !collections.includes(collectionId))
        collections.push(collectionId);

    collections.forEach(collectionId => {
        const metadataItems = (metadataPrefix === 'ead')
            ? updateEAD(xml, oaiIdentifier, collectionId)
            : updateMarc(xml, oaiIdentifier, collectionId);
        allMetadata.push(...metadataItems);
    });

    await updateItems(allMetadata);
}

function updateEAD(xml, oaiIdentifier, collectionId) {
    const [rootId, unitId] = collectionId.split('.');

    const access = EAD.getAccess(collectionId, xml);
    const metadata = EAD.getMetadata(collectionId, xml);

    let prevUnitId = null;
    return metadata.map(md => {
        const item = {
            id: (md.unitId === rootId) ? rootId : `${rootId}.${md.unitId}`,
            metadata_id: oaiIdentifier,
            label: md.title
        };

        if (prevUnitId)
            item.parent_id = prevUnitId;

        if (md.content)
            item.description = md.content;

        if (md.authors)
            item.authors = md.authors;

        if (md.language)
            item.language = md.language;

        if (md.unitId === unitId)
            item.iish = {access};
        else
            item.type = 'metadata';
        prevUnitId = item.id;

        return item;
    });
}

function updateMarc(xml, oaiIdentifier, collectionId) {
    return [];
}

module.exports = processMetadata;
