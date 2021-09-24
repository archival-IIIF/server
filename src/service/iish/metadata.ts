import got from 'got';
import {parseXml, Document, Element} from 'libxmljs2';

import config from '../../lib/Config';
import logger from '../../lib/Logger';
import {MetadataParams} from '../../lib/Service';
import {MinimalItem} from '../../lib/ItemInterfaces';
import {updateItems, getCollectionsByMetadataId, getCollectionIdsIndexed} from '../../lib/Item';

import * as EAD from './util/EAD';
import * as MarcXML from './util/MARCXML';

const ns = {
    'marc': 'http://www.loc.gov/MARC21/slim'
};

export default async function processMetadata({oaiIdentifier, rootId, collectionId}: MetadataParams): Promise<void> {
    if (!config.metadataOaiUrl || !config.metadataSrwUrl)
        throw new Error('Cannot process metadata, as there is no OAI or SRW URL configured!');

    try {
        if (!oaiIdentifier && rootId)
            oaiIdentifier = `oai:socialhistoryservices.org:10622/${rootId}`;

        if (!oaiIdentifier && collectionId)
            oaiIdentifier = await getOAIIdentifier(collectionId, config.metadataSrwUrl);

        if (oaiIdentifier)
            await updateWithIdentifier(oaiIdentifier, collectionId);
    }
    catch (e: any) {
        const err = new Error(`Failed to process the metadata for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

export async function getOAIIdentifier(collectionId: string, uri: string): Promise<string | null> {
    // TODO: Temporary Z168896, Z209183 records for testing with serials
    if (collectionId.includes('ARCH') || collectionId.includes('COLL') || collectionId.includes('Z168896') || collectionId.includes('Z209183')) {
        const rootId = EAD.getRootId(collectionId);
        return `oai:socialhistoryservices.org:10622/${rootId}`;
    }

    const response = await got(uri, {
        https: {rejectUnauthorized: false}, resolveBodyOnly: true, searchParams: {
            operation: 'searchRetrieve',
            query: `marc.852$p="${collectionId}"`
        }
    });

    const srwResults = parseXml(response);
    const marcId = srwResults.get<Element>('//marc:controlfield[@tag="001"]', ns);

    if (marcId)
        return `oai:socialhistoryservices.org:${marcId.text()}`;

    return null;
}

async function updateWithIdentifier(oaiIdentifier: string, collectionId?: string): Promise<void> {
    logger.debug(`Start metadata update using OAI identifier ${oaiIdentifier}`);

    // TODO: Temporary Z168896, Z209183 records for testing with serials
    const metadataPrefix = oaiIdentifier.includes('ARCH') || oaiIdentifier.includes('COLL') || oaiIdentifier.includes('Z168896') || oaiIdentifier.includes('Z209183') ? 'ead' : 'marcxml';
    const xml = await got(config.metadataOaiUrl as string, {
        https: {rejectUnauthorized: false}, resolveBodyOnly: true, searchParams: {
            verb: 'GetRecord',
            identifier: oaiIdentifier,
            metadataPrefix
        }
    });

    const allMetadata: MinimalItem[] = [];
    const xmlParsed = parseXml(xml);

    const collections = new Set<string>();
    if (collectionId)
        collections.add(collectionId);
    else {
        for (const colId of await getCollectionsByMetadataId(oaiIdentifier))
            collections.add(colId);

        if (metadataPrefix === 'marcxml') {
            const collectionIds = MarcXML.getCollectionIds(xmlParsed);
            for (const colId of await getCollectionIdsIndexed(collectionIds))
                collections.add(colId);
        }
        else {
            const collectionId = oaiIdentifier.replace('oai:socialhistoryservices.org:10622/', '');
            for (const colId of await getCollectionIdsIndexed(EAD.getRootId(collectionId)))
                collections.add(colId);
        }
    }

    logger.debug(`Updating metadata for collections: ${Array.from(collections).join(' ')}`);

    for (const collectionId of collections) {
        const metadataItems = (metadataPrefix === 'ead')
            ? updateEAD(xmlParsed, oaiIdentifier, collectionId)
            : updateMarc(xmlParsed, oaiIdentifier, collectionId);
        allMetadata.push(...metadataItems);
    }

    await updateItems(allMetadata);

    logger.debug(`Updated metadata using OAI identifier ${oaiIdentifier}`);
}

export function updateEAD(xml: Document, oaiIdentifier: string, collectionId: string): MinimalItem[] {
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
            metadata: []
        };

        if (prevUnitId)
            item.parent_id = prevUnitId;

        if (md.order)
            item.order = md.order;

        if (md.content)
            item.description = md.content;

        if (md.authors)
            item.authors = md.authors;

        if (md.dates)
            item.dates = md.dates;

        if (md.extent)
            item.physical = md.extent;

        if (md.unitId === unitId) {
            item.iish = {
                type: 'ead',
                access,
                metadataHdl: '10622/' + collectionId
            }
        }

        if (md.eadTitle)
            item.metadata.push({label: 'Part of', value: md.eadTitle});

        if (md.unitIdIsInventoryNumber)
            item.metadata.push({label: 'Inventory number', value: md.unitId});

        prevUnitId = item.id;

        return item;
    });
}

export function updateMarc(xml: Document, oaiIdentifier: string, collectionId: string): MinimalItem[] {
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
