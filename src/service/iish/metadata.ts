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
            oaiIdentifier = `${EAD.EAD_OAI_PREFIX}${rootId}`;

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

export async function getOAIIdentifier(collectionId: string, url: string): Promise<string | null> {
    const rootId = EAD.getRootId(collectionId);
    if (collectionId.includes('ARCH') || collectionId.includes('COLL'))
        return `${EAD.EAD_OAI_PREFIX}${rootId}`;

    const marcSearchResult = await got(url, {
        https: {rejectUnauthorized: false}, resolveBodyOnly: true, searchParams: {
            operation: 'searchRetrieve',
            query: `marc.852$p="${collectionId}"`
        }
    });

    const srwResults = parseXml(marcSearchResult);
    const marcId = MarcXML.getId(srwResults);
    if (marcId)
        return `${MarcXML.MARC_OAI_PREFIX}${marcId}`;

    if (rootId !== collectionId) {
        const marcRootSearchResult = await got(url, {
            https: {rejectUnauthorized: false}, resolveBodyOnly: true, searchParams: {
                operation: 'searchRetrieve',
                query: `marc.852$p="${rootId}"`
            }
        });

        const srwResults = parseXml(marcRootSearchResult);
        const marcLeader = srwResults.get<Element>('//marc:leader', ns);
        if (marcLeader) {
            const format = MarcXML.getFormat(marcLeader.text());
            if (format === 'serial')
                return `${EAD.EAD_OAI_PREFIX}${rootId}`;
        }
    }

    return null;
}

async function updateWithIdentifier(oaiIdentifier: string, collectionId?: string): Promise<void> {
    logger.debug(`Start metadata update using OAI identifier ${oaiIdentifier}`);

    const metadataPrefix = oaiIdentifier.startsWith(EAD.EAD_OAI_PREFIX) ? 'ead' : 'marcxml';
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
            const collectionId = oaiIdentifier.replace(EAD.EAD_OAI_PREFIX, '');
            for (const colId of await getCollectionIdsIndexed(EAD.getRootId(collectionId)))
                collections.add(colId);
        }
    }

    logger.debug(`Updating metadata for collections: ${Array.from(collections).join(' ')}`);

    for (const collectionId of collections) {
        const metadataItems = (metadataPrefix === 'ead')
            ? updateEAD(xmlParsed, oaiIdentifier, collectionId)
            : updateMarc(xmlParsed, oaiIdentifier, collectionId);

        for (const mdItem of metadataItems) {
            if (!allMetadata.find(md => md.id === mdItem.id))
                allMetadata.push(mdItem);
        }
    }

    const access: { [id: string]: string } = {};
    for (const mdItem of allMetadata) {
        if (!mdItem.parent_id && !mdItem.iish) {
            const marcRootSearchResult = await got(config.metadataSrwUrl as string, {
                https: {rejectUnauthorized: false}, resolveBodyOnly: true, searchParams: {
                    operation: 'searchRetrieve',
                    query: `marc.852$p="${mdItem.id}"`
                }
            });

            const rootMarcXml = parseXml(marcRootSearchResult);
            const marcLeader = rootMarcXml.get<Element>('//marc:leader', ns);
            if (marcLeader) {
                const format = MarcXML.getFormat(marcLeader.text());
                if (format === 'serial') {
                    updateRootWithMarc(rootMarcXml, mdItem);
                    access[mdItem.id] = mdItem.iish.access;
                }
            }
        }
        else if (mdItem.iish && mdItem.top_parent_id in access)
            mdItem.iish.access = access[mdItem.top_parent_id];
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

        if (prevUnitId) {
            item.top_parent_id = rootId;
            item.parent_id = prevUnitId;
        }

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
            };
        }

        if (collectionId.includes('ARCH') || collectionId.includes('COLL')) {
            if (md.eadTitle)
                item.metadata.push({label: 'Part of', value: md.eadTitle});

            if (md.unitIdIsInventoryNumber)
                item.metadata.push({label: 'Inventory number', value: md.unitId});
        }

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

export function updateRootWithMarc(xml: Document, item: MinimalItem): void {
    const access = MarcXML.getAccess(item.id, xml);
    const metadata = MarcXML.getMetadata(item.id, xml);

    for (const md of metadata) {
        item.metadata_id = `${MarcXML.MARC_OAI_PREFIX}${MarcXML.getId(xml)}`;

        item.formats = [md.format];
        item.label = md.title;
        item.iish = {
            access,
            type: 'marcxml',
            metadataHdl: md.metadataHdl
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
    }
}
