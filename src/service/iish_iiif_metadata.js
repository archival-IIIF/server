async function getMetadata({item}) {
    const metadata = [];

    if (item.iish && item.iish.metadataHdl)
        metadata.push({
            label: 'Refer to this record',
            value: `<a href="https://hdl.handle.net/10622/${item.iish.metadataHdl}" target="_blank">https://hdl.handle.net/10622/${item.iish.metadataHdl}</a>`
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

module.exports = getMetadata;
