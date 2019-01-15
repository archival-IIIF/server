const moment = require('moment');
const libxmljs = require('libxmljs');
const request = require('request-promise-native');
const config = require('../lib/Config');
const logger = require('../lib/Logger');
const {runTask} = require('../lib/Task');

const ns = {
    'oai': 'http://www.openarchives.org/OAI/2.0/'
};

async function updateMetadata() {
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
                const identifier = headerElem.get('./oai:identifier', ns).text();
                runTask('metadata', {oaiIdentifier: identifier});
            });
        }
    }
    catch (err) {
        logger.error('Failed to run the recurring update metadata procedure: ' + err.message);
    }
}

module.exports = updateMetadata;
