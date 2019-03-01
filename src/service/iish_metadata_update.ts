import * as moment from 'moment';
import * as libxmljs from 'libxmljs';
import * as request from 'request-promise-native';

import config from '../lib/Config';
import logger from '../lib/Logger';
import {runTask} from '../lib/Task';
import {MetadataParams} from '../lib/Service';

const ns = {
    'oai': 'http://www.openarchives.org/OAI/2.0/'
};

export default async function updateMetadata(): Promise<void> {
    if (!config.metadataOaiUrl)
        throw new Error('Failed to run the update metadata service: there is no OAI URL configured!');

    try {
        const fromDate = moment().subtract(5, 'days').format('YYYY-MM-DD');

        let resumptionToken = null;
        while (resumptionToken !== false) {
            const response = await request({
                uri: config.metadataOaiUrl, strictSSL: false, qs: {
                    verb: 'ListIdentifiers',
                    metadataPrefix: 'marcxml',
                    from: fromDate,
                    resumptionToken: resumptionToken || undefined
                }
            });

            const oaiResults = libxmljs.parseXml(response);

            const resumptionTokenElem = oaiResults.get('//oai:resumptionToken', ns);
            resumptionToken = resumptionTokenElem ? resumptionTokenElem.text() : false;

            oaiResults.find('//oai:header', ns).forEach(headerElem => {
                const identifierElem = headerElem.get('./oai:identifier', ns.oai);
                if (identifierElem)
                    runTask<MetadataParams>('metadata', {oaiIdentifier: identifierElem.text()});
            });
        }
    }
    catch (err) {
        logger.error('Failed to run the recurring update metadata procedure: ' + err.message);
    }
}
