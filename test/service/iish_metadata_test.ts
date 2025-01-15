import {join} from 'node:path';
import {XmlDocument} from 'libxml2-wasm';

import nock from 'nock';
import {expect} from 'chai';
import {readFile} from 'node:fs/promises';

import {
    getOAIIdentifier,
    updateEAD,
    updateMarc
} from '../../src/service/iish/metadata.js';

const testRootDirectory = './test/service';

describe('iish_metadata', () => {
    describe('#getOAIIdentifier()', () => {
        beforeEach(() => {
            nock('http://srw')
                .get('/')
                .query({
                    operation: 'searchRetrieve',
                    query: 'marc.852$p="1234567890"'
                })
                .reply(200, `<?xml version="1.0" encoding="UTF-8"?>
                <searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
                  <version>1.1</version>
                  <numberOfRecords>1</numberOfRecords>
                  <resultSetId>j81yf1</resultSetId>
                  <resultSetIdleTime>300</resultSetIdleTime>
                  <records xmlns:ns1="http://www.loc.gov/zing/srw/">
                    <record>
                      <recordSchema>info:srw/schema/1/marcxml-v1.1</recordSchema>
                      <recordPacking>xml</recordPacking>
                      <recordData>
                        <marc:record xmlns:marc="http://www.loc.gov/MARC21/slim" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                                     xsi:schemaLocation="http://www.loc.gov/MARC21/slim http://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd">
                          <marc:leader>00395nkm a22001577a 4500</marc:leader>
                          <marc:controlfield tag="001">N12345</marc:controlfield>
                        </marc:record>
                      </recordData>
                    </record>
                  </records>
                </searchRetrieveResponse>`)
                .get('/')
                .query(true)
                .reply(200, `<?xml version="1.0" encoding="UTF-8"?>
                <searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
                  <version>1.1</version>
                  <numberOfRecords>0</numberOfRecords>
                </searchRetrieveResponse>`);
        });

        it('should determine the OAI indentifier from an ARCH identifier', async () => {
            const identifier = await getOAIIdentifier('ARCH12345');

            expect(identifier).to.equal('oai:socialhistoryservices.org:10622/ARCH12345');
        });

        it('should determine the OAI indentifier from an COLL identifier', async () => {
            const identifier = await getOAIIdentifier('COLL12345');

            expect(identifier).to.equal('oai:socialhistoryservices.org:10622/COLL12345');
        });

        it('should determine the OAI indentifier from the MARCXML result from an SRW call', async () => {
            const identifier = await getOAIIdentifier('1234567890');

            expect(identifier).to.equal('oai:socialhistoryservices.org:N12345');
        });

        it('should return no OAI indentifier if the MARCXML does not exist', async () => {
            const identifier = await getOAIIdentifier('567890');

            expect(identifier).to.be.null;
        });
    });

    describe('#updateEAD()', () => {
        it('should parse the metadata from an EAD description', async () => {
            using xml = XmlDocument.fromBuffer(await readFile(join(testRootDirectory, 'test-iish-metadata/ead.xml')));
            const metadata = updateEAD(xml, 'oai:socialhistoryservices.org:10622/ARCH12345', 'ARCH12345.3');

            expect(metadata).to.deep.equal([
                {
                    'id': 'ARCH12345',
                    'collection_id': 'ARCH12345',
                    'metadata_id': 'oai:socialhistoryservices.org:10622/ARCH12345',
                    'formats': [],
                    'label': 'Collection title',
                    'metadata': [],
                    'description': 'The content of this archive.<br/>Is described in here.',
                    'authors': [
                        {
                            'type': 'Creator',
                            'name': 'Creator of this archive'
                        },
                        {
                            'type': 'Other Creator',
                            'name': 'Another creator of this archive'
                        }
                    ],
                    'dates': [
                        '2019'
                    ],
                    'physical': '1 m.',
                    'parent_id': null,
                    'parent_ids': [],
                    'order': 1
                },
                {
                    'id': 'ARCH12345.dda3da21e3f74df90a6160aebac41f6b',
                    'collection_id': 'ARCH12345.dda3da21e3f74df90a6160aebac41f6b',
                    'metadata_id': 'oai:socialhistoryservices.org:10622/ARCH12345',
                    'formats': [],
                    'label': 'Second set',
                    'metadata': [{
                        'label': 'Part of',
                        'value': 'Collection title'
                    }],
                    'parent_id': 'ARCH12345',
                    'parent_ids': ['ARCH12345'],
                    'order': 2
                },
                {
                    'id': 'ARCH12345.3',
                    'collection_id': 'ARCH12345.3',
                    'metadata_id': 'oai:socialhistoryservices.org:10622/ARCH12345',
                    'formats': [],
                    'label': 'No 3 from 2019',
                    'metadata': [
                        {
                            'label': 'Part of',
                            'value': 'Collection title'
                        },
                        {
                            'label': 'Inventory number',
                            'value': '3'
                        }
                    ],
                    'iish': {
                        'metadataHdl': '10622/ARCH12345.3',
                        'access': 'open',
                        'type': 'ead'
                    },
                    'parent_id': 'ARCH12345.dda3da21e3f74df90a6160aebac41f6b',
                    'parent_ids': ['ARCH12345.dda3da21e3f74df90a6160aebac41f6b', 'ARCH12345'],
                    'dates': [
                        '2019'
                    ],
                    'physical': '1 piece',
                    'order': 1
                }
            ]);
        });
    });

    describe('#updateMarc()', () => {
        it('should parse the metadata from an MARC XML description', async () => {
            using xml = XmlDocument.fromBuffer(await readFile(join(testRootDirectory, 'test-iish-metadata/marc.xml')));
            const metadata = updateMarc(xml, 'oai:socialhistoryservices.org:12345', 'N12345');

            expect(metadata).to.deep.equal([
                {
                    'id': 'N12345',
                    'collection_id': 'N12345',
                    'metadata_id': 'oai:socialhistoryservices.org:12345',
                    'formats': ['visual'],
                    'label': 'The title',
                    'metadata': [{
                        'label': 'Call number',
                        'value': 'IISG 123'
                    }],
                    'iish': {
                        'access': 'pictoright',
                        'metadataHdl': '10622/N12345',
                        'type': 'marcxml'
                    },
                    'description': 'A description of this object.',
                    'authors': [
                        {
                            'type': 'Author',
                            'name': 'Name of the author'
                        },
                        {
                            'type': 'A subject person',
                            'name': 'Another person'
                        }
                    ],
                    'dates': [
                        '2019'
                    ],
                    'physical': '100 p'
                }
            ]);
        });
    });
});