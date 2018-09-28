const request = require('request-promise-native');
const EAD = require('./iish/EAD');
const config = require('../lib/Config');
const {getEmptyItem, updateItems} = require('../lib/Item');

async function processMetadata({collectionId}) {
    if (collectionId.startsWith('ARCH') || collectionId.startsWith('COLL')) {
        const [rootId, unitId] = collectionId.split('.');
        const eadXml = await request({
            uri: config.metadataOaiUrl, strictSSL: false, qs: {
                verb: 'GetRecord',
                identifier: `oai:socialhistoryservices.org:10622/${rootId}`,
                metadataPrefix: 'ead'
            }
        });

        const access = EAD.getAccess(collectionId, eadXml);
        const metadata = EAD.getMetadata(collectionId, eadXml);

        let prevUnitId = null;
        updateItems(metadata.map(md => {
            const item = {
                id: (md.unitId === rootId) ? rootId : `${rootId}.${md.unitId}`,
                metadata_id: rootId,
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
        }));
    }
}

module.exports = processMetadata;
