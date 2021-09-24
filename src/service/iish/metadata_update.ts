import got from 'got';
import moment from 'moment';
import {parseXml, Element} from 'libxmljs2';

import config from '../../lib/Config';
import logger from '../../lib/Logger';
import {runTask} from '../../lib/Task';
import {MetadataParams} from '../../lib/Service';

const ns = {
    'oai': 'http://www.openarchives.org/OAI/2.0/'
};

export default async function updateMetadata(): Promise<void> {
    if (!config.metadataOaiUrl)
        throw new Error('Failed to run the update metadata service: there is no OAI URL configured!');

    try {
        const fromDate = moment().subtract(5, 'days').format('YYYY-MM-DD');
        for (const oaiIdentifier of await getOAIIdentifiersOfUpdated(fromDate, config.metadataOaiUrl))
            runTask<MetadataParams>('metadata', {oaiIdentifier});
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
            https: {rejectUnauthorized: false}, resolveBodyOnly: true, searchParams: {
                verb: 'ListIdentifiers',
                metadataPrefix: 'marcxml',
                from: fromDate,
                ...(resumptionToken ? {resumptionToken} : {})
            }
        });

        const oaiResults = parseXml(response);

        const resumptionTokenElem = oaiResults.get<Element>('//oai:resumptionToken', ns);
        resumptionToken = resumptionTokenElem ? resumptionTokenElem.text() : false;

        const foundIdentifiers = (oaiResults.root() as Element)
            .find<Element>('//oai:header', ns)
            .map(headerElem => headerElem.get<Element>('./oai:identifier', ns))
            .filter(identifierElem => identifierElem !== null)
            .map(identifierElem => (identifierElem as Element).text());

        oaiIdentifiers.push(...foundIdentifiers);
    }

    return oaiIdentifiers;
}
