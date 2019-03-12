import * as nock from 'nock';
import {expect} from 'chai';

import {getOAIIdentifiersOfUpdated} from '../../src/service/iish_metadata_update';

describe('iish_metadata_update', () => {
    describe('#getOAIIdentifiersOfUpdated()', () => {
        beforeEach(() => {
            nock('http://api')
                .get('/')
                .query({
                    verb: 'ListIdentifiers',
                    metadataPrefix: 'marcxml',
                    from: '2019-01-01'
                })
                .reply(200, `<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
                             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                             xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/
                             http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
                      <ListIdentifiers>
                        <header>
                          <identifier>oai:socialhistoryservices.org:123</identifier>
                        </header>
                        <header>
                          <identifier>oai:socialhistoryservices.org:456</identifier>
                        </header>
                        <header>
                          <identifier>oai:socialhistoryservices.org:789</identifier>
                        </header>
                        <resumptionToken>resumptionToken1</resumptionToken>
                      </ListIdentifiers>
                    </OAI-PMH>`)
                .get('/')
                .query({
                    verb: 'ListIdentifiers',
                    metadataPrefix: 'marcxml',
                    from: '2019-01-01',
                    resumptionToken: 'resumptionToken1'
                })
                .reply(200, `<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
                             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                             xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/
                             http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
                      <ListIdentifiers>
                        <header>
                          <identifier>oai:socialhistoryservices.org:abc</identifier>
                        </header>
                        <header>
                          <identifier>oai:socialhistoryservices.org:def</identifier>
                        </header>
                        <header>
                          <identifier>oai:socialhistoryservices.org:ghi</identifier>
                        </header>
                        <resumptionToken>resumptionToken2</resumptionToken>
                      </ListIdentifiers>
                    </OAI-PMH>`)
                .get('/')
                .query({
                    verb: 'ListIdentifiers',
                    metadataPrefix: 'marcxml',
                    from: '2019-01-01',
                    resumptionToken: 'resumptionToken2'
                })
                .reply(200, `<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
                             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                             xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/
                             http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
                      <ListIdentifiers>
                        <header>
                          <identifier>oai:socialhistoryservices.org:last-one</identifier>
                        </header>
                      </ListIdentifiers>
                    </OAI-PMH>`);
        });

        it('should determine the OAI indentifier from an ARCH identifier', async () => {
            const identifiers = await getOAIIdentifiersOfUpdated('2019-01-01', 'http://api');

            expect(identifiers).to.deep.equal([
                'oai:socialhistoryservices.org:123',
                'oai:socialhistoryservices.org:456',
                'oai:socialhistoryservices.org:789',
                'oai:socialhistoryservices.org:abc',
                'oai:socialhistoryservices.org:def',
                'oai:socialhistoryservices.org:ghi',
                'oai:socialhistoryservices.org:last-one'
            ]);
        });
    });
});