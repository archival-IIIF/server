import got from 'got';
import {XmlDocument} from 'libxml2-wasm';

import config from '../../lib/Config.js';
import logger from '../../lib/Logger.js';
import {MinimalItem} from '../../lib/ItemInterfaces.js';
import {MetadataParams} from '../../lib/ServiceTypes.js';
import {updateItems, getCollectionsByMetadataId, getCollectionIdsIndexed} from '../../lib/Item.js';

import * as EAD from './util/EAD.js';
import * as MarcXML from './util/MARCXML.js';

const ns = {
    'marc': 'http://www.loc.gov/MARC21/slim'
};

export default async function processMetadata({metadataId, rootId, collectionId}: MetadataParams): Promise<void> {
    if (!config.metadataOaiUrl || !config.metadataSrwUrl)
        throw new Error('Cannot process metadata, as there is no OAI or SRW URL configured!');

    try {
        if (!metadataId && rootId)
            metadataId = `${EAD.EAD_OAI_PREFIX}${rootId}`;

        if (!metadataId && collectionId)
            metadataId = await getOAIIdentifier(collectionId);

        if (metadataId)
            await updateWithIdentifier(metadataId, collectionId);
    }
    catch (e: any) {
        const err = new Error(`Failed to process the metadata for ${collectionId}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
}

export async function getOAIIdentifier(collectionId: string): Promise<string | null> {
    const rootId = EAD.getRootId(collectionId);
    if (collectionId.includes('ARCH') || collectionId.includes('COLL'))
        return `${EAD.EAD_OAI_PREFIX}${rootId}`;

    const marcSearchResult = await got(config.metadataSrwUrl as string, {
        https: {rejectUnauthorized: false}, resolveBodyOnly: true, responseType: 'buffer', searchParams: {
            operation: 'searchRetrieve',
            query: `marc.852$p="${collectionId}"`
        }
    });

    using srwResults = XmlDocument.fromBuffer(marcSearchResult);
    const marcId = MarcXML.getId(srwResults);
    if (marcId)
        return `${MarcXML.MARC_OAI_PREFIX}${marcId}`;

    if (rootId !== collectionId) {
        const marcRootSearchResult = await got(config.metadataSrwUrl as string, {
            https: {rejectUnauthorized: false}, resolveBodyOnly: true, responseType: 'buffer', searchParams: {
                operation: 'searchRetrieve',
                query: `marc.852$p="${rootId}"`
            }
        });

        using srwResults = XmlDocument.fromBuffer(marcRootSearchResult);
        const marcLeader = srwResults.get('//marc:leader', ns);
        if (marcLeader) {
            const format = MarcXML.getFormat(marcLeader.content);
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
        https: {rejectUnauthorized: false}, resolveBodyOnly: true, responseType: 'buffer', searchParams: {
            verb: 'GetRecord',
            identifier: oaiIdentifier,
            metadataPrefix
        }
    });

    using xmlParsed = XmlDocument.fromBuffer(xml);

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

    const allMetadata: MinimalItem[] = [];
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
                https: {rejectUnauthorized: false}, resolveBodyOnly: true, responseType: 'buffer', searchParams: {
                    operation: 'searchRetrieve',
                    query: `marc.852$p="${mdItem.id}"`
                }
            });

            using rootMarcXml = XmlDocument.fromBuffer(marcRootSearchResult);
            const marcLeader = rootMarcXml.get('//marc:leader', ns);
            if (marcLeader) {
                const format = MarcXML.getFormat(marcLeader.content);
                if (format === 'serial') {
                    updateRootWithMarc(rootMarcXml, mdItem);
                    access[mdItem.id] = mdItem.iish.access;
                }
            }
        }
        else if (mdItem.iish && mdItem.parent_ids?.length > 0 && mdItem.parent_ids[mdItem.parent_ids.length - 1] in access)
            mdItem.iish.access = access[mdItem.parent_ids[mdItem.parent_ids.length - 1]];
    }

    await updateItems(allMetadata);

    logger.debug(`Updated metadata using OAI identifier ${oaiIdentifier}`);
}

export function updateEAD(xml: XmlDocument, oaiIdentifier: string, collectionId: string): MinimalItem[] {
    const rootId = EAD.getRootId(collectionId);
    const unitId = EAD.getUnitId(collectionId);

    const access = EAD.getAccess(collectionId, xml);
    const metadata = EAD.getMetadata(collectionId, xml);

    let parents: string[] = [];
    return metadata.map(md => {
        const id = (md.unitId === rootId) ? rootId : `${rootId}.${md.unitId}`;
        const item: MinimalItem = {
            id: id,
            parent_id: parents.length > 0 ? parents[0] : null,
            parent_ids: parents,
            collection_id: id,
            metadata_id: oaiIdentifier,
            formats: md.formats,
            label: md.title,
            metadata: []
        };

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

        parents = [id, ...parents];

        return item;
    });
}

export function updateMarc(xml: XmlDocument, oaiIdentifier: string, collectionId: string): MinimalItem[] {
    const access = MarcXML.getAccess(xml);
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

        updateMarcMetadata(md, item);

        return item;
    });
}

export function updateRootWithMarc(xml: XmlDocument, item: MinimalItem): void {
    const access = MarcXML.getAccess(xml);
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

        updateMarcMetadata(md, item);
    }
}

function updateMarcMetadata(md: MarcXML.MARCXMLMetadata, item: MinimalItem): void {
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
