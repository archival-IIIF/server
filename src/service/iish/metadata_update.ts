import got from 'got';
import dayjs from 'dayjs';
import {XmlDocument} from 'libxml2-wasm';

import config from '../../lib/Config.js';
import logger from '../../lib/Logger.js';
import {runTask} from '../../lib/Task.js';
import {MetadataParams} from '../../lib/ServiceTypes.js';

const ns = {
    'oai': 'http://www.openarchives.org/OAI/2.0/'
};

export default async function updateMetadata(): Promise<void> {
    if (!config.metadataOaiUrl)
        throw new Error('Failed to run the update metadata service: there is no OAI URL configured!');

    try {
        const fromDate = dayjs().subtract(5, 'day').format('YYYY-MM-DD');
        for (const oaiIdentifier of await getOAIIdentifiersOfUpdated(fromDate, config.metadataOaiUrl))
            runTask<MetadataParams>('metadata', {metadataId: oaiIdentifier});
    }
    catch (err: any) {
        logger.error(`Failed to run the recurring update metadata procedure: ${err.message}`, {err});
    }
}

export async function getOAIIdentifiersOfUpdated(fromDate: string, uri: string): Promise<string[]> {
    const oaiIdentifiers: string[] = [];

    let resumptionToken = null;
    while (resumptionToken !== false) {
        const response = await got(uri, {
            https: {rejectUnauthorized: false}, resolveBodyOnly: true, responseType: 'buffer', searchParams: {
                verb: 'ListIdentifiers',
                metadataPrefix: 'marcxml',
                from: fromDate,
                ...(resumptionToken ? {resumptionToken} : {})
            }
        });

        using oaiResults = XmlDocument.fromBuffer(response);

        const resumptionTokenElem = oaiResults.get('//oai:resumptionToken', ns);
        resumptionToken = resumptionTokenElem ? resumptionTokenElem.content : false;

        const foundIdentifiers = oaiResults
            .find('//oai:header', ns)
            .map(headerElem => headerElem.get('./oai:identifier', ns)?.content)
            .filter(identifierElem => identifierElem !== undefined);

        oaiIdentifiers.push(...foundIdentifiers);
    }

    return oaiIdentifiers;
}
