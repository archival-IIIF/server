const config = require('../lib/Config');

async function getIIIFMetadata({item}) {
    return {
        homepage: getHomepage(item),
        metadata: getMetadata(item),
        seeAlso: getSeeAlso(item)
    };
}

function getHomepage(item) {
    if (item.iish && item.iish.metadataHdl)
        return {
            id: `https://hdl.handle.net/${item.iish.metadataHdl}`,
            label: 'Homepage'
        };

    return null;
}

function getMetadata(item) {
    const metadata = [];

    if (item.iish && item.iish.metadataHdl)
        metadata.push({
            label: 'Refer to this record',
            value: `<a href="https://hdl.handle.net/${item.iish.metadataHdl}" target="_blank">https://hdl.handle.net/${item.iish.metadataHdl}</a>`
        });

    if (item.type === 'root' || (item.type === 'folder' && item.id === item.collection_id))
        metadata.push({
            label: 'Refer to this item',
            value: `<a href="https://hdl.handle.net/10622/${item.id}" target="_blank">https://hdl.handle.net/10622/${item.id}</a>`
        });
    else if (['folder', 'file', 'image', 'audio', 'video', 'pdf'].includes(item.type))
        metadata.push({
            label: `Refer to this ${item.type}`,
            value: `<a href="https://hdl.handle.net/10622/${item.id}" target="_blank">https://hdl.handle.net/10622/${item.id}</a>`
        });

    if (item.iish && item.iish.access)
        metadata.push({
            label: 'Use restrictions for this item',
            value: '<a href="https://socialhistory.org/en/services/copyrights" target="_blank">' +
                'Please consult the IISH copyright statement before using this item</a>'
        });

    return metadata;
}

function getSeeAlso(item) {
    const seeAlso = [];

    if (config.metadataOaiUrl && item.metadata_id) {
        const metadataPrefix = (item.metadata_id.includes('ARCH') || item.metadata_id.includes('COLL'))
            ? 'ead' : 'marcxml';
        seeAlso.push({
            id: `${config.metadataOaiUrl}?verb=GetRecord&identifier=${item.metadata_id}&metadataPrefix=${metadataPrefix}`,
            format: 'text/xml',
            profile: (metadataPrefix === 'ead') ? 'http://www.loc.gov/ead/ead.xsd' : 'http://www.loc.gov/MARC21/slim',
            label: `${metadataPrefix.toUpperCase()} metadata describing this object`
        });
    }

    return seeAlso;
}

module.exports = getIIIFMetadata;
