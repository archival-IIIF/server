import * as libxmljs from 'libxmljs';
import * as request from 'request-promise-native';

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
            const marcId = srwResults.get('//marc:controlfield[@tag="001"]', ns);

            if (marcId)
                oaiIdentifier = `oai:socialhistoryservices.org:${marcId.text()}`;
        }
    }

    if (oaiIdentifier)
        await updateWithIdentifier(oaiIdentifier, collectionId);
}

async function updateWithIdentifier(oaiIdentifier: string, collectionId?: string): Promise<void> {
    const metadataPrefix = (oaiIdentifier.includes('ARCH') || oaiIdentifier.includes('COLL'))
        ? 'ead' : 'marcxml';
    const xml = await request({
        uri: config.metadataOaiUrl as string, strictSSL: false, qs: {
            verb: 'GetRecord',
            identifier: oaiIdentifier,
            metadataPrefix
        }
    });

    const allMetadata: MinimalItem[] = [];

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

function updateEAD(xml: string, oaiIdentifier: string, collectionId: string): MinimalItem[] {
    const [rootId, unitId] = collectionId.split('.');

    const access = EAD.getAccess(collectionId, xml);
    const metadata = EAD.getMetadata(collectionId, xml);

    let prevUnitId: string | null = null;
    return metadata.map(md => {
        const id = (md.unitId === rootId) ? rootId : `${rootId}.${md.unitId}`;
        const item: MinimalItem = {
            id: id,
            collection_id: id,
            metadata_id: oaiIdentifier,
            label: md.title as string,
            iish: {
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

        prevUnitId = item.id;

        return item;
    });
}

function updateMarc(xml: string, oaiIdentifier: string, collectionId: string): MinimalItem[] {
    const access = MarcXML.getAccess(collectionId, xml);
    const metadata = MarcXML.getMetadata(collectionId, xml);

    return metadata.map(md => {
        const item: MinimalItem = {
            id: collectionId,
            collection_id: collectionId,
            metadata_id: oaiIdentifier,
            label: md.title as string,
            iish: {
                access,
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

        return item;
    });
}
