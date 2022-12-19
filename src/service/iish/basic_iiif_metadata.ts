import config from '../../lib/Config.js';
import {Item} from '../../lib/ItemInterfaces.js';
import {
    ItemParams,
    BasicIIIFMetadata,
    IIIFMetadataHomepage,
    IIIFMetadataPairs,
    IIIFMetadataSeeAlso
} from '../../lib/ServiceTypes.js';

import {EAD_OAI_PREFIX} from './util/EAD.js';
import {MARC_OAI_PREFIX} from './util/MARCXML.js';

export default async function getBasicIIIFMetadata({item}: ItemParams): Promise<BasicIIIFMetadata> {
    return {
        behavior: item.formats.includes('book') ? 'paged' : 'individuals',
        homepage: getHomepage(item),
        metadata: getMetadata(item),
        seeAlso: getSeeAlso(item)
    };
}

function getHomepage(item: Item): IIIFMetadataHomepage {
    const homepages = [];

    if (item.iish && item.iish.metadataHdl)
        homepages.push({
            id: `https://hdl.handle.net/${item.iish.metadataHdl}`,
            label: 'Homepage'
        });

    if (item.iish && item.iish.type === 'marcxml' && item.metadata_id) {
        const id = item.metadata_id.replace(MARC_OAI_PREFIX, '');
        homepages.push({
            id: `https://iisg.amsterdam/id/item/${id}`,
            label: 'RDF'
        });
    }

    if (item.iish && item.iish.type === 'ead' && item.metadata_id) {
        const id = item.metadata_id.replace(EAD_OAI_PREFIX, '');
        homepages.push({
            id: `https://iisg.amsterdam/id/collection/${id}`,
            label: 'RDF'
        });
    }

    return homepages;
}

function getMetadata(item: Item): IIIFMetadataPairs {
    const metadata = [];

    if (item.iish && item.iish.metadataHdl)
        metadata.push({
            label: 'Refer to this record',
            value: `<a href="https://hdl.handle.net/${item.iish.metadataHdl}">https://hdl.handle.net/${item.iish.metadataHdl}</a>`
        });

    if (item.type === 'root' || (item.type === 'folder' && item.id === item.collection_id))
        metadata.push({
            label: 'Refer to this item',
            value: `<a href="https://hdl.handle.net/10622/${item.id}">https://hdl.handle.net/10622/${item.id}</a>`
        });
    else if (['image'].includes(item.type))
        metadata.push({
            label: 'Refer to this image',
            value: `<a href="https://hdl.handle.net/10622/${item.id}?locatt=view:level1">https://hdl.handle.net/10622/${item.id}?locatt=view:level1</a>`
        });
    else if (['folder', 'file', 'audio', 'video', 'pdf'].includes(item.type))
        metadata.push({
            label: `Refer to this ${item.type}`,
            value: `<a href="https://hdl.handle.net/10622/${item.id}">https://hdl.handle.net/10622/${item.id}</a>`
        });

    if (item.iish && item.iish.access)
        metadata.push({
            label: 'Use restrictions for this item',
            value: '<a href="https://iisg.amsterdam/en/collections/using/reproductions#copyrights">' +
                'Please consult the IISH copyright statement before using this item</a>'
        });

    return metadata;
}

function getSeeAlso(item: Item): IIIFMetadataSeeAlso {
    const seeAlso = [];

    if (config.metadataOaiUrl && item.metadata_id && item.iish?.type) {
        seeAlso.push({
            id: `${config.metadataOaiUrl}?verb=GetRecord&identifier=${item.metadata_id}&metadataPrefix=${item.iish.type}`,
            format: 'text/xml',
            profile: (item.iish.type === 'ead') ? 'http://www.loc.gov/ead/ead.xsd' : 'http://www.loc.gov/MARC21/slim',
            label: `${item.iish.type.toUpperCase()} metadata describing this object`
        });
    }

    return seeAlso;
}
