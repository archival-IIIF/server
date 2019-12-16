import * as got from 'got';
import * as libxmljs from 'libxmljs';

import config from '../lib/Config';
import {MetadataParams} from '../lib/Service';
import {MinimalItem} from '../lib/ItemInterfaces';
import {updateItems, getCollectionsByMetadataId} from '../lib/Item';

import * as EAD from './iish/EAD';
import * as MarcXML from './iish/MARCXML';

const ns = {
    'marc': 'http://www.loc.gov/MARC21/slim'
};

export default async function processMetadata({oaiIdentifier, collectionId}: MetadataParams): Promise<void> {
    if (!config.metadataOaiUrl || !config.metadataSrwUrl)
        throw new Error('Cannot process metadata, as there is no OAI or SRW URL configured!');

    try {
        if (!oaiIdentifier && collectionId)
            oaiIdentifier = await getOAIIdentifier(collectionId, config.metadataSrwUrl);

        if (oaiIdentifier)
            await updateWithIdentifier(oaiIdentifier, collectionId);
    }
    catch (e) {
        const err = new Error(`Failed to process the metadata for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

export async function getOAIIdentifier(collectionId: string, uri: string): Promise<string | null> {
    if (collectionId.includes('ARCH') || collectionId.includes('COLL')) {
        const rootId = EAD.getRootId(collectionId);
        return `oai:socialhistoryservices.org:10622/${rootId}`;
    }

    const response = await got.default(uri, {
        rejectUnauthorized: false, resolveBodyOnly: true, searchParams: {
            operation: 'searchRetrieve',
            query: `marc.852$p="${collectionId}"`
        }
    });

    const srwResults = libxmljs.parseXml(response);
    const marcId = srwResults.get('//marc:controlfield[@tag="001"]', ns);

    if (marcId)
        return `oai:socialhistoryservices.org:${marcId.text()}`;

    return null;
}

async function updateWithIdentifier(oaiIdentifier: string, collectionId?: string): Promise<void> {
    const metadataPrefix = oaiIdentifier.includes('ARCH') || oaiIdentifier.includes('COLL') ? 'ead' : 'marcxml';
    const xml = await got.default(config.metadataOaiUrl as string, {
        rejectUnauthorized: false, resolveBodyOnly: true, searchParams: {
            verb: 'GetRecord',
            identifier: oaiIdentifier,
            metadataPrefix
        }
    });

    const allMetadata: MinimalItem[] = [];
    const xmlParsed = libxmljs.parseXml(xml);

    const collections = collectionId ? [collectionId] : await getCollectionsByMetadataId(oaiIdentifier);
    collections.forEach(collectionId => {
        const metadataItems = (metadataPrefix === 'ead')
            ? updateEAD(xmlParsed, oaiIdentifier, collectionId)
            : updateMarc(xmlParsed, oaiIdentifier, collectionId);
        allMetadata.push(...metadataItems);
    });

    await updateItems(allMetadata);
}

export function updateEAD(xml: libxmljs.Document, oaiIdentifier: string, collectionId: string): MinimalItem[] {
    const rootId = EAD.getRootId(collectionId);
    const unitId = EAD.getUnitId(collectionId);

    const access = EAD.getAccess(collectionId, xml);
    const metadata = EAD.getMetadata(collectionId, xml);

    let prevUnitId: string | null = null;
    return metadata.map(md => {
        const id = (md.unitId === rootId) ? rootId : `${rootId}.${md.unitId}`;
        const item: MinimalItem = {
            id: id,
            collection_id: id,
            metadata_id: oaiIdentifier,
            formats: md.formats,
            label: md.title,
            metadata: [],
            iish: {
                type: 'ead',
                metadataHdl: '10622/' + collectionId
            }
        };

        if (prevUnitId)
            item.parent_id = prevUnitId;

        if (md.content)
            item.description = md.content;

        if (md.authors)
            item.authors = md.authors;

        if (md.dates)
            item.dates = md.dates;

        if (md.extent)
            item.physical = md.extent;

        if (md.unitId === unitId)
            item.iish.access = access;

        if (md.eadTitle)
            item.metadata.push({label: 'Part of', value: md.eadTitle});

        if (md.unitIdIsInventoryNumber)
            item.metadata.push({label: 'Inventory number', value: md.unitId});

        prevUnitId = item.id;

        return item;
    });
}

export function updateMarc(xml: libxmljs.Document, oaiIdentifier: string, collectionId: string): MinimalItem[] {
    const access = MarcXML.getAccess(collectionId, xml);
    const metadata = MarcXML.getMetadata(collectionId, xml);

    return metadata.map(md => {
        const item: MinimalItem = {
            id: collectionId,
            collection_id: collectionId,
            metadata_id: oaiIdentifier,
            formats: [md.format],
            label: md.title,
            metadata: [],
            iish: {
                access,
                type: 'marcxml',
                metadataHdl: md.metadataHdl
            }
        };

        if (md.description)
            item.description = md.description;

        if (md.authors)
            item.authors = md.authors;

        if (md.dates)
            item.dates = md.dates;

        if (md.physical)
            item.physical = md.physical;

        if (md.signature)
            item.metadata.push({label: 'Call number', value: md.signature});

        return item;
    });
}
