import {join} from 'path';
import {expect} from 'chai';

import {parseXml, Element} from 'libxmljs2';

import {createItem} from '../../src/lib/Item.js';
import {
    processCollection,
    getIdentifier,
    determineResolution,
    determineDpi,
    determineDuration,
    determineEncoding, ns,
} from '../../src/service/util/archivematica.js';

const testRootDirectory = './test/service';
const rej = (err: Error) => err;

describe('archivematica', () => {
    describe('#processCollection()', () => {
        it('should fail for an empty collection', async () => {
            const result = await processCollection('', {type: 'root'}).then(null, rej);
            expect(result).to.be.an('error');
        });

        describe('having collections with invalid METS files', () => {
            it('should fail for missing a physical structmap', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-structmap');
                const result = await processCollection(path, {type: 'root'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('Could not find the physical structmap in the METS file');
            });

            it('should fail for missing a root item', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-root-item');
                const result = await processCollection(path, {type: 'root'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('Could not find the root metadata for DMD id dmdSec_1');
            });

            it('should fail for missing the label of an item in the structmap', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-label');
                const result = await processCollection(path, {type: 'root'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('Expected to find a label for an element in the structmap');
            });

            it('should fail for missing a premis object for a folder', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-premis-object-folder');
                const result = await processCollection(path, {type: 'folder'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('No premis object found for DMD id dmdSec_2');
            });

            it('should fail for missing the original name of a folder', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-name-folder');
                const result = await processCollection(path, {type: 'folder'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('No original name found for dmdSec_2');
            });

            it('should fail for missing the identifier of a folder', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-id-folder');
                const result = await processCollection(path, {type: 'folder'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('No identifier found for dmdSec_2');
            });

            it('should fail for missing a fptr of a file', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-fptr-file');
                const result = await processCollection(path, {type: 'folder'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('Missing a fptr or file id for a file with the label test_0001.tif');
            });

            it('should fail for missing the original name of a file', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-name-file');
                const result = await processCollection(path, {type: 'folder'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('No original name found for amdSec_5');
            });

            it('should fail for missing the identifier of a file', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-id-file');
                const result = await processCollection(path, {type: 'folder'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('No identifier found for amdSec_5');
            });

            it('should fail for missing the object characteristics of a file', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-obj-chars-file');
                const result = await processCollection(path, {type: 'folder'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('No object characteristics found for AMD id amdSec_5');
            });

            it('should fail for missing the binary of a file', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-objects-file');
                const result = await processCollection(path, {type: 'folder'}).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('Expected to find a file starting with 2a863aca-eff6-4bb7-812f-cb797e75f793');
            });

            it('should fail for missing a fptr of a file for a text layer', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/invalid-mets-no-fptr-text');
                const result = await processCollection(path, {
                    type: 'root',
                    isFile: (label: string, parents: string[]) => parents[0] !== 'transcription' && !parents[0].startsWith('translation_'),
                    isText: (label: string, parents: string[]) => parents[0] === 'transcription' || parents[0].startsWith('translation_'),
                }).then(null, rej);

                expect(result).to.be.an('error');
                expect((result as Error).message).to.equal('Missing a file id for a file for the text layer with label test_01.txt');
            });
        });

        describe('having collections resulting in valid items', () => {
            it('should return valid items for a digital born collection', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/digital-born');
                const {rootItem, childItems, textItems} = await processCollection(path, {type: 'folder'});

                expect(textItems).to.be.empty;
                expect(rootItem).to.deep.equal(createItem({
                    'id': 'test',
                    'collection_id': 'test',
                    'type': 'folder',
                    'label': 'test'
                }));
                expect(childItems).to.deep.equal([
                    createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'folder',
                        'id': '36a44e3e-d93e-4305-8df8-8ae94031c712',
                        'collection_id': 'test',
                        'label': '14 - Silly filenames'
                    }), createItem({
                        'parent_id': '36a44e3e-d93e-4305-8df8-8ae94031c712',
                        'parent_ids': ['36a44e3e-d93e-4305-8df8-8ae94031c712', 'test'],
                        'type': 'file',
                        'size': 5,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/d861c189-17b6-44f4-98c1-6183365ae7b2-_.________.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': 'd861c189-17b6-44f4-98c1-6183365ae7b2',
                        'collection_id': 'test',
                        'label': '*."[]:;|=,.txt'
                    }), createItem({
                        'parent_id': '36a44e3e-d93e-4305-8df8-8ae94031c712',
                        'parent_ids': ['36a44e3e-d93e-4305-8df8-8ae94031c712', 'test'],
                        'type': 'pdf',
                        'size': 937592,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/cde36b27-4f35-4943-9b43-3690176f1573-s____________een_PDF.pdf'),
                            'puid': 'fmt/18'
                        },
                        'id': 'cde36b27-4f35-4943-9b43-3690176f1573',
                        'collection_id': 'test',
                        'label': 's %    !  & $een PDF.pdf'
                    }), createItem({
                        'parent_id': '36a44e3e-d93e-4305-8df8-8ae94031c712',
                        'parent_ids': ['36a44e3e-d93e-4305-8df8-8ae94031c712', 'test'],
                        'type': 'file',
                        'size': 6,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/b2eadb49-d49d-4840-8b58-4db5ae2cc1c0-filename_with_a___grave_accent.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': 'b2eadb49-d49d-4840-8b58-4db5ae2cc1c0',
                        'collection_id': 'test',
                        'label': 'filename with a ` grave accent.txt'
                    }), createItem({
                        'parent_id': '36a44e3e-d93e-4305-8df8-8ae94031c712',
                        'parent_ids': ['36a44e3e-d93e-4305-8df8-8ae94031c712', 'test'],
                        'type': 'file',
                        'size': 394892,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/99826f9b-3557-4af1-94cf-a33908970592-Is._a_()_DOCX_file.docx'),
                            'puid': 'fmt/412'
                        },
                        'id': '99826f9b-3557-4af1-94cf-a33908970592',
                        'collection_id': 'test',
                        'label': 'Is. a () DOCX file.docx'
                    }), createItem({
                        'parent_id': '36a44e3e-d93e-4305-8df8-8ae94031c712',
                        'parent_ids': ['36a44e3e-d93e-4305-8df8-8ae94031c712', 'test'],
                        'type': 'folder',
                        'id': '9b8cdd0e-3b4c-49f6-aa27-4d001c123939',
                        'collection_id': 'test',
                        'label': 'Is %    !  &  foldër'
                    }), createItem({
                        'parent_id': '9b8cdd0e-3b4c-49f6-aa27-4d001c123939',
                        'parent_ids': ['9b8cdd0e-3b4c-49f6-aa27-4d001c123939', '36a44e3e-d93e-4305-8df8-8ae94031c712', 'test'],
                        'type': 'file',
                        'size': 12,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/5e87e233-0cbf-44e2-869b-81096ac45083-hello.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': '5e87e233-0cbf-44e2-869b-81096ac45083',
                        'collection_id': 'test',
                        'label': 'hello.txt'
                    }), createItem({
                        'parent_id': '36a44e3e-d93e-4305-8df8-8ae94031c712',
                        'parent_ids': ['36a44e3e-d93e-4305-8df8-8ae94031c712', 'test'],
                        'type': 'folder',
                        'id': '3792e009-83d0-4b65-a8a4-d6c6e717ee81',
                        'collection_id': 'test',
                        'label': 'folder with a ` grave accent'
                    }), createItem({
                        'parent_id': '3792e009-83d0-4b65-a8a4-d6c6e717ee81',
                        'parent_ids': ['3792e009-83d0-4b65-a8a4-d6c6e717ee81', '36a44e3e-d93e-4305-8df8-8ae94031c712', 'test'],
                        'type': 'file',
                        'size': 6,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/e0f7fd08-aede-446c-9018-380935607146-hello.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': 'e0f7fd08-aede-446c-9018-380935607146',
                        'collection_id': 'test',
                        'label': 'hello.txt'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'folder',
                        'id': '9fa985d4-0afb-4c97-88e6-c4d822f71b1c',
                        'collection_id': 'test',
                        'label': '01 - Foreign languages'
                    }), createItem({
                        'parent_id': '9fa985d4-0afb-4c97-88e6-c4d822f71b1c',
                        'parent_ids': ['9fa985d4-0afb-4c97-88e6-c4d822f71b1c', 'test'],
                        'type': 'file',
                        'size': 31627,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/48655999-3cb5-491a-b7b7-71de271b2ced-coleccoes_digitais_afluencia.docx'),
                            'puid': 'fmt/412'
                        },
                        'id': '48655999-3cb5-491a-b7b7-71de271b2ced',
                        'collection_id': 'test',
                        'label': 'colecções digitais afluência.docx'
                    }), createItem({
                        'parent_id': '9fa985d4-0afb-4c97-88e6-c4d822f71b1c',
                        'parent_ids': ['9fa985d4-0afb-4c97-88e6-c4d822f71b1c', 'test'],
                        'type': 'file',
                        'size': 32368,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/0e3e7a54-42cb-4b95-b7c7-3103dd17e132-Pritok_tsifrovykh_kollektsii.docx'),
                            'puid': 'fmt/412'
                        },
                        'id': '0e3e7a54-42cb-4b95-b7c7-3103dd17e132',
                        'collection_id': 'test',
                        'label': 'Приток цифровых коллекций.docx'
                    }), createItem({
                        'parent_id': '9fa985d4-0afb-4c97-88e6-c4d822f71b1c',
                        'parent_ids': ['9fa985d4-0afb-4c97-88e6-c4d822f71b1c', 'test'],
                        'type': 'file',
                        'size': 33886,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/e2264454-c4b4-48b7-a1e6-10cbe4898883-antrbaah_ddijittaal_sNgrh.docx'),
                            'puid': 'fmt/412'
                        },
                        'id': 'e2264454-c4b4-48b7-a1e6-10cbe4898883',
                        'collection_id': 'test',
                        'label': 'অন্তর্বাহ ডিজিটাল সংগ্রহ.docx'
                    }), createItem({
                        'parent_id': '9fa985d4-0afb-4c97-88e6-c4d822f71b1c',
                        'parent_ids': ['9fa985d4-0afb-4c97-88e6-c4d822f71b1c', 'test'],
                        'type': 'file',
                        'size': 30156,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/27e5fd23-ddb4-4152-ac10-311ce53a5d5f-Liu_Ru_Shu_Zi_Guan_Cang_.docx'),
                            'puid': 'fmt/412'
                        },
                        'id': '27e5fd23-ddb4-4152-ac10-311ce53a5d5f',
                        'collection_id': 'test',
                        'label': '流入數字館藏.docx'
                    }), createItem({
                        'parent_id': '9fa985d4-0afb-4c97-88e6-c4d822f71b1c',
                        'parent_ids': ['9fa985d4-0afb-4c97-88e6-c4d822f71b1c', 'test'],
                        'type': 'file',
                        'size': 32764,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/cdabc053-5770-4fff-8fe7-a6db2b86bb0f-mjmw_h_hy_dyjytl_jryn.docx'),
                            'puid': 'fmt/412'
                        },
                        'id': 'cdabc053-5770-4fff-8fe7-a6db2b86bb0f',
                        'collection_id': 'test',
                        'label': 'مجموعه های دیجیتال جریان.docx'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'folder',
                        'id': '4467a746-4f5c-4c58-9521-5e13537e4ba7',
                        'collection_id': 'test',
                        'label': '15 - Structured collection'
                    }), createItem({
                        'parent_id': '4467a746-4f5c-4c58-9521-5e13537e4ba7',
                        'parent_ids': ['4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': '20a7ae4f-cf9c-4769-8db3-ef9c043d799f',
                        'collection_id': 'test',
                        'label': 'untitled folder 3'
                    }), createItem({
                        'parent_id': '20a7ae4f-cf9c-4769-8db3-ef9c043d799f',
                        'parent_ids': ['20a7ae4f-cf9c-4769-8db3-ef9c043d799f', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': '0668afa1-cb11-4b5f-9d37-e1b6cad93c77',
                        'collection_id': 'test',
                        'label': 'untitled subfolder 1'
                    }), createItem({
                        'parent_id': '0668afa1-cb11-4b5f-9d37-e1b6cad93c77',
                        'parent_ids': ['0668afa1-cb11-4b5f-9d37-e1b6cad93c77', '20a7ae4f-cf9c-4769-8db3-ef9c043d799f', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'file',
                        'size': 25,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/8f6d51c3-44f4-48f5-92ac-9b57a1eecd44-file_5.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': '8f6d51c3-44f4-48f5-92ac-9b57a1eecd44',
                        'collection_id': 'test',
                        'label': 'file 5.txt'
                    }), createItem({
                        'parent_id': '4467a746-4f5c-4c58-9521-5e13537e4ba7',
                        'parent_ids': ['4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': '326d47e5-68be-4b67-9714-e2651ae37d54',
                        'collection_id': 'test',
                        'label': 'untitled folder 2'
                    }), createItem({
                        'parent_id': '326d47e5-68be-4b67-9714-e2651ae37d54',
                        'parent_ids': ['326d47e5-68be-4b67-9714-e2651ae37d54', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'file',
                        'size': 25,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/5a05c498-491b-4e7e-8c8f-082d2a048e30-file_3.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': '5a05c498-491b-4e7e-8c8f-082d2a048e30',
                        'collection_id': 'test',
                        'label': 'file 3.txt'
                    }), createItem({
                        'parent_id': '326d47e5-68be-4b67-9714-e2651ae37d54',
                        'parent_ids': ['326d47e5-68be-4b67-9714-e2651ae37d54', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': '2180bd46-305a-4e44-85ee-650c5c69bd93',
                        'collection_id': 'test',
                        'label': 'untitled subfolder 1'
                    }), createItem({
                        'parent_id': '2180bd46-305a-4e44-85ee-650c5c69bd93',
                        'parent_ids': ['2180bd46-305a-4e44-85ee-650c5c69bd93', '326d47e5-68be-4b67-9714-e2651ae37d54', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'file',
                        'size': 25,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/d2992c1d-47cd-4ac2-91c4-4b923dfaa009-file_4.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': 'd2992c1d-47cd-4ac2-91c4-4b923dfaa009',
                        'collection_id': 'test',
                        'label': 'file 4.txt'
                    }), createItem({
                        'parent_id': '4467a746-4f5c-4c58-9521-5e13537e4ba7',
                        'parent_ids': ['4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': '865d980f-de1f-4531-9a10-d0e1ff63accf',
                        'collection_id': 'test',
                        'label': 'untitled folder name with more than so many characters'
                    }), createItem({
                        'parent_id': '865d980f-de1f-4531-9a10-d0e1ff63accf',
                        'parent_ids': ['865d980f-de1f-4531-9a10-d0e1ff63accf', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': 'f2a2170f-185e-4b6c-a0bb-2a429117adf8',
                        'collection_id': 'test',
                        'label': 'untitled subfolder name with more than so many characters'
                    }), createItem({
                        'parent_id': 'f2a2170f-185e-4b6c-a0bb-2a429117adf8',
                        'parent_ids': ['f2a2170f-185e-4b6c-a0bb-2a429117adf8', '865d980f-de1f-4531-9a10-d0e1ff63accf', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': 'b2b5791b-74dd-4087-a4eb-668697ad4133',
                        'collection_id': 'test',
                        'label': 'untitled subsubfolder name with more than so many characters'
                    }), createItem({
                        'parent_id': 'b2b5791b-74dd-4087-a4eb-668697ad4133',
                        'parent_ids': ['b2b5791b-74dd-4087-a4eb-668697ad4133', 'f2a2170f-185e-4b6c-a0bb-2a429117adf8', '865d980f-de1f-4531-9a10-d0e1ff63accf', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': '45e69b0e-b143-4ac0-b6a1-308b564a2172',
                        'collection_id': 'test',
                        'label': 'long subsubsubfolder name with more than so many characters'
                    }), createItem({
                        'parent_id': '45e69b0e-b143-4ac0-b6a1-308b564a2172',
                        'parent_ids': ['45e69b0e-b143-4ac0-b6a1-308b564a2172', 'b2b5791b-74dd-4087-a4eb-668697ad4133', 'f2a2170f-185e-4b6c-a0bb-2a429117adf8', '865d980f-de1f-4531-9a10-d0e1ff63accf', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'file',
                        'size': 25,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/76bf89e6-513c-4aee-ae0e-6a0f44642e49-long_filename_with_more_than_two_hundred_and_sixty_five_characters.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': '76bf89e6-513c-4aee-ae0e-6a0f44642e49',
                        'collection_id': 'test',
                        'label': 'long filename with more than two hundred and sixty five characters.txt'
                    }), createItem({
                        'parent_id': '865d980f-de1f-4531-9a10-d0e1ff63accf',
                        'parent_ids': ['865d980f-de1f-4531-9a10-d0e1ff63accf', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'folder',
                        'id': '4094f821-32ef-4d28-8727-43f477c49cd3',
                        'collection_id': 'test',
                        'label': 'untitled subfolder 2'
                    }), createItem({
                        'parent_id': '4094f821-32ef-4d28-8727-43f477c49cd3',
                        'parent_ids': ['4094f821-32ef-4d28-8727-43f477c49cd3', '865d980f-de1f-4531-9a10-d0e1ff63accf', '4467a746-4f5c-4c58-9521-5e13537e4ba7', 'test'],
                        'type': 'file',
                        'size': 25,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/e2ac85c1-a0e1-4654-bff2-c1ed42f173d8-file_2.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': 'e2ac85c1-a0e1-4654-bff2-c1ed42f173d8',
                        'collection_id': 'test',
                        'label': 'file 2.txt'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'folder',
                        'id': '15a9b5bf-73a3-4cd0-a4de-9eea871c60b5',
                        'collection_id': 'test',
                        'label': '00 - General collection'
                    }), createItem({
                        'parent_id': '15a9b5bf-73a3-4cd0-a4de-9eea871c60b5',
                        'parent_ids': ['15a9b5bf-73a3-4cd0-a4de-9eea871c60b5', 'test'],
                        'type': 'image',
                        'size': 158562,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'width': 660,
                        'height': 986,
                        'resolution': 300,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/27d72523-a748-47d3-bb30-f351971d6d5b-9000004608.jpg'),
                            'puid': 'x-fmt/391'
                        },
                        'id': '27d72523-a748-47d3-bb30-f351971d6d5b',
                        'collection_id': 'test',
                        'label': '9000004608.jpg'
                    }), createItem({
                        'parent_id': '15a9b5bf-73a3-4cd0-a4de-9eea871c60b5',
                        'parent_ids': ['15a9b5bf-73a3-4cd0-a4de-9eea871c60b5', 'test'],
                        'type': 'pdf',
                        'size': 937592,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/4ab2e912-77dc-49d1-8640-8db5ad1b3faf-dpctw11-01.pdf'),
                            'puid': 'fmt/18'
                        },
                        'id': '4ab2e912-77dc-49d1-8640-8db5ad1b3faf',
                        'collection_id': 'test',
                        'label': 'dpctw11-01.pdf'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'folder',
                        'id': '19404958-cc13-49ab-81e2-e7ef3625ac67',
                        'collection_id': 'test',
                        'label': '09 - Packed files'
                    }), createItem({
                        'parent_id': '19404958-cc13-49ab-81e2-e7ef3625ac67',
                        'parent_ids': ['19404958-cc13-49ab-81e2-e7ef3625ac67', 'test'],
                        'type': 'folder',
                        'id': 'd42fbca6-ce71-4519-9f2a-2cd6eed25bc1',
                        'collection_id': 'test',
                        'label': 'Packed files 1.zip'
                    }), createItem({
                        'parent_id': 'd42fbca6-ce71-4519-9f2a-2cd6eed25bc1',
                        'parent_ids': ['d42fbca6-ce71-4519-9f2a-2cd6eed25bc1', '19404958-cc13-49ab-81e2-e7ef3625ac67', 'test'],
                        'type': 'file',
                        'size': 3788,
                        'created_at': new Date('2016-06-12T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/cfb12b25-43e7-4544-b59e-56afce43b8bb-uitleg-archivematica.txt'),
                            'puid': 'x-fmt/111'
                        },
                        'id': 'cfb12b25-43e7-4544-b59e-56afce43b8bb',
                        'collection_id': 'test',
                        'label': 'uitleg-archivematica.txt'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'folder',
                        'id': '1b1ad765-c4a7-4632-afe4-5b8326df8a7a',
                        'collection_id': 'test',
                        'label': '02 - Audio and video'
                    }), createItem({
                        'parent_id': '1b1ad765-c4a7-4632-afe4-5b8326df8a7a',
                        'parent_ids': ['1b1ad765-c4a7-4632-afe4-5b8326df8a7a', 'test'],
                        'type': 'folder',
                        'id': '08e45eca-b21c-4ba9-9efe-3b1d1d441600',
                        'collection_id': 'test',
                        'label': 'video'
                    }), createItem({
                        'parent_id': '08e45eca-b21c-4ba9-9efe-3b1d1d441600',
                        'parent_ids': ['08e45eca-b21c-4ba9-9efe-3b1d1d441600', '1b1ad765-c4a7-4632-afe4-5b8326df8a7a', 'test'],
                        'type': 'video',
                        'size': 7196047,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'width': 768,
                        'height': 576,
                        'duration': 29.376,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/2826689d-bab9-49d9-9e96-cfe5a44a4937-F113.mp4'),
                            'puid': 'fmt/199'
                        },
                        'id': '2826689d-bab9-49d9-9e96-cfe5a44a4937',
                        'collection_id': 'test',
                        'label': 'F113.mp4'
                    }), createItem({
                        'parent_id': '08e45eca-b21c-4ba9-9efe-3b1d1d441600',
                        'parent_ids': ['08e45eca-b21c-4ba9-9efe-3b1d1d441600', '1b1ad765-c4a7-4632-afe4-5b8326df8a7a', 'test'],
                        'type': 'video',
                        'size': 6513420,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'width': 768,
                        'height': 576,
                        'duration': 23.352,
                        'original': {
                            'uri': null, 'puid': 'fmt/5'
                        },
                        'access': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/8f5bf966-4c42-4b1b-a3aa-04e2a8b2c971-F113.mp4'),
                            'puid': 'fmt/199'
                        },
                        'id': '8f5bf966-4c42-4b1b-a3aa-04e2a8b2c971',
                        'collection_id': 'test',
                        'label': 'F113.avi'
                    }), createItem({
                        'parent_id': '1b1ad765-c4a7-4632-afe4-5b8326df8a7a',
                        'parent_ids': ['1b1ad765-c4a7-4632-afe4-5b8326df8a7a', 'test'],
                        'type': 'folder',
                        'id': '03fdd2a1-d7c4-4e05-8560-248c1c84f253',
                        'collection_id': 'test',
                        'label': 'audio'
                    }), createItem({
                        'parent_id': '03fdd2a1-d7c4-4e05-8560-248c1c84f253',
                        'parent_ids': ['03fdd2a1-d7c4-4e05-8560-248c1c84f253', '1b1ad765-c4a7-4632-afe4-5b8326df8a7a', 'test'],
                        'type': 'audio',
                        'size': 247848,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'duration': 15.464,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/1b42c5be-5a78-4e64-91e4-0548ccea0d70-Die_Internationale_as_mp3.mp3'),
                            'puid': 'fmt/134'
                        },
                        'id': '1b42c5be-5a78-4e64-91e4-0548ccea0d70',
                        'collection_id': 'test',
                        'label': 'Die_Internationale as mp3.mp3'
                    }), createItem({
                        'parent_id': '03fdd2a1-d7c4-4e05-8560-248c1c84f253',
                        'parent_ids': ['03fdd2a1-d7c4-4e05-8560-248c1c84f253', '1b1ad765-c4a7-4632-afe4-5b8326df8a7a', 'test'],
                        'type': 'audio',
                        'size': 2722964,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'duration': 15.436,
                        'original': {
                            'uri': null, 'puid': 'fmt/141'
                        },
                        'access': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/740158f5-601d-40ee-b4da-6f554a398858-Die_Internationale_as_wav.mp3'),
                            'puid': 'fmt/134'
                        },
                        'id': '740158f5-601d-40ee-b4da-6f554a398858',
                        'collection_id': 'test',
                        'label': 'Die_Internationale as wav.wav'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'folder',
                        'id': '9129d878-4bdb-449b-8fca-60c9a47c92d6',
                        'collection_id': 'test',
                        'label': '16 - Virus material'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'folder',
                        'id': '7b5cd45e-1d10-48ce-a98b-3128bbad140d',
                        'collection_id': 'test',
                        'label': '04 - Word processing files'
                    }), createItem({
                        'parent_id': '7b5cd45e-1d10-48ce-a98b-3128bbad140d',
                        'parent_ids': ['7b5cd45e-1d10-48ce-a98b-3128bbad140d', 'test'],
                        'type': 'file',
                        'size': 103936,
                        'created_at': new Date('2018-07-10T22:00:00.000Z'),
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digital-born/objects/766bbce1-0bc1-4b08-86cc-3ddff91e8c66-Testfile_Archivematica_-_DE_BASIS_voor_vervaardiging_van_videomateriaal.doc'),
                            'puid': 'fmt/40'
                        },
                        'id': '766bbce1-0bc1-4b08-86cc-3ddff91e8c66',
                        'collection_id': 'test',
                        'label': 'Testfile Archivematica - DE BASIS voor vervaardiging van videomateriaal.doc'
                    })
                ]);
            });

            it('should return valid items for a digitized single object collection', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/digitized-single-object');
                const {rootItem, childItems, textItems} = await processCollection(path, {type: 'root'});

                expect(textItems).to.be.empty;
                expect(rootItem).to.deep.equal(createItem({
                    'type': 'root',
                    'id': 'test',
                    'collection_id': 'test',
                    'label': 'test'
                }));
                expect(childItems).to.deep.equal([
                    createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 144401772,
                        'created_at': new Date('2017-10-05T22:00:00.000Z'),
                        'width': 5854,
                        'height': 8221,
                        'resolution': 300,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-single-object/objects/2a863aca-eff6-4bb7-812f-cb797e75f793-test_0001.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': '2a863aca-eff6-4bb7-812f-cb797e75f793',
                        'collection_id': 'test',
                        'label': 'test_0001.tif'
                    })
                ]);
            });

            it('should return valid items for a digitized images collection', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/digitized-images');
                const {rootItem, childItems, textItems} = await processCollection(path, {
                    type: 'root',
                    customStructMapId: 'structMap_iish',
                    isFile: (label: string, parents: string[]) => parents[0] !== 'transcription' && !parents[0].startsWith('translation_'),
                    isText: (label: string, parents: string[]) => parents[0] === 'transcription' || parents[0].startsWith('translation_'),
                    getTypeAndLang: (label: string, parents: string[]) => ({
                        type: parents[0].startsWith('translation_') ? 'translation' : 'transcription',
                        language: parents[0].startsWith('translation_') ? parents[0].split('_')[1] : null
                    }),
                    withRootCustomForText: (rootCustom: Element, fileId: string) => {
                        const fptrs = rootCustom.find<Element>(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/../mets:fptr`, ns);
                        return fptrs
                            .map(fptrElem => fptrElem.attr('FILEID')?.value())
                            .find(id => id && id !== fileId) as string;
                    },
                });

                expect(rootItem).to.deep.equal(createItem({
                    'type': 'root',
                    'id': 'test',
                    'collection_id': 'test',
                    'label': 'test'
                }));
                expect(childItems).to.deep.equal([
                    createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 16976840,
                        'created_at': new Date('2018-10-08T22:00:00.000Z'),
                        'width': 1960,
                        'height': 2887,
                        'resolution': 304,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/b8b7aca7-0a0d-452e-a98d-94c8e7607aa5-test_01.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': 'b8b7aca7-0a0d-452e-a98d-94c8e7607aa5',
                        'collection_id': 'test',
                        'label': 'test_01.tif'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 16751032,
                        'created_at': new Date('2018-10-08T22:00:00.000Z'),
                        'width': 1942,
                        'height': 2875,
                        'resolution': 304,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/9a99eef6-3e69-4cdf-ae68-4f304194bb64-test_02.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': '9a99eef6-3e69-4cdf-ae68-4f304194bb64',
                        'collection_id': 'test',
                        'label': 'test_02.tif'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 16839700,
                        'created_at': new Date('2018-10-08T22:00:00.000Z'),
                        'width': 1955,
                        'height': 2871,
                        'resolution': 304,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/88348a48-c658-4150-a1bb-e4b05d6f1f2b-test_03.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': '88348a48-c658-4150-a1bb-e4b05d6f1f2b',
                        'collection_id': 'test',
                        'label': 'test_03.tif'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 16814940,
                        'created_at': new Date('2018-10-08T22:00:00.000Z'),
                        'width': 1944,
                        'height': 2883,
                        'resolution': 304,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/a236198f-1844-4771-baac-59712c767fbe-test_04.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': 'a236198f-1844-4771-baac-59712c767fbe',
                        'collection_id': 'test',
                        'label': 'test_04.tif'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 16814940,
                        'created_at': new Date('2018-10-08T22:00:00.000Z'),
                        'width': 1944,
                        'height': 2883,
                        'resolution': 304,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/62a1e40c-af27-472c-b870-818d6cb6464b-test_05.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': '62a1e40c-af27-472c-b870-818d6cb6464b',
                        'collection_id': 'test',
                        'label': 'test_05.tif'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 16883520,
                        'created_at': new Date('2018-10-08T22:00:00.000Z'),
                        'width': 1956,
                        'height': 2877,
                        'resolution': 304,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/76cf7fac-c2f9-412c-b773-2872777646f6-test_06.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': '76cf7fac-c2f9-412c-b773-2872777646f6',
                        'collection_id': 'test',
                        'label': 'test_06.tif'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 16676376,
                        'created_at': new Date('2018-10-08T22:00:00.000Z'),
                        'width': 1932,
                        'height': 2877,
                        'resolution': 304,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/62008a42-e2e7-4446-95f2-c5aa70ceacf7-test_07.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': '62008a42-e2e7-4446-95f2-c5aa70ceacf7',
                        'collection_id': 'test',
                        'label': 'test_07.tif'
                    }), createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 16835720,
                        'created_at': new Date('2018-10-08T22:00:00.000Z'),
                        'width': 1960,
                        'height': 2863,
                        'resolution': 304,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/96693817-a99b-4c78-833f-7c9ff4b7c089-test_08.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': '96693817-a99b-4c78-833f-7c9ff4b7c089',
                        'collection_id': 'test',
                        'label': 'test_08.tif'
                    })
                ]);
                expect(textItems).to.deep.equal([
                    {
                        'collectionId': 'test',
                        'id': 'cf34ab26-d4a2-4b73-99bf-9da8171084b0',
                        'itemId': 'b8b7aca7-0a0d-452e-a98d-94c8e7607aa5',
                        'type': 'transcription',
                        'language': null,
                        'encoding': 'ISO-8859-1',
                        'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/cf34ab26-d4a2-4b73-99bf-9da8171084b0-test_01.txt')
                    }, {
                        'collectionId': 'test',
                        'id': 'cf32e677-59d9-4245-ba1b-ba56572a16b9',
                        'itemId': '88348a48-c658-4150-a1bb-e4b05d6f1f2b',
                        'type': 'transcription',
                        'language': null,
                        'encoding': 'UTF-8',
                        'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/cf32e677-59d9-4245-ba1b-ba56572a16b9-test_03.txt')
                    }, {
                        'collectionId': 'test',
                        'id': '029f77b2-f464-4746-9312-bb58603c91e3',
                        'itemId': 'a236198f-1844-4771-baac-59712c767fbe',
                        'type': 'transcription',
                        'language': null,
                        'encoding': 'UTF-8',
                        'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/029f77b2-f464-4746-9312-bb58603c91e3-test_04.txt')
                    }, {
                        'collectionId': 'test',
                        'id': 'ddc232cf-9a29-45b1-89f0-da4b39ff73ee',
                        'itemId': '62a1e40c-af27-472c-b870-818d6cb6464b',
                        'type': 'transcription',
                        'language': null,
                        'encoding': 'ISO-8859-1',
                        'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/ddc232cf-9a29-45b1-89f0-da4b39ff73ee-test_05.txt')
                    }, {
                        'collectionId': 'test',
                        'id': 'ebd8c23a-5e65-49ee-8b82-f6fa269d8ace',
                        'itemId': '76cf7fac-c2f9-412c-b773-2872777646f6',
                        'type': 'transcription',
                        'language': null,
                        'encoding': 'UTF-8',
                        'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/ebd8c23a-5e65-49ee-8b82-f6fa269d8ace-test_06.txt')
                    }, {
                        'collectionId': 'test',
                        'id': '833c9e39-399f-4b60-b1ec-7d407ced96e4',
                        'itemId': '62008a42-e2e7-4446-95f2-c5aa70ceacf7',
                        'type': 'transcription',
                        'language': null,
                        'encoding': 'UTF-8',
                        'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-images/objects/833c9e39-399f-4b60-b1ec-7d407ced96e4-test_07.txt')
                    }
                ]);
            });

            it('should return valid items for a digitized audio collection', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/digitized-audio');
                const {rootItem, childItems, textItems} = await processCollection(path, {type: 'root'});

                expect(textItems).to.be.empty;
                expect(rootItem).to.deep.equal(createItem({
                    'type': 'root',
                    'id': 'test',
                    'collection_id': 'test',
                    'label': 'test'
                }));
                expect(childItems).to.deep.equal([
                    createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'audio',
                        'size': 21626768,
                        'created_at': new Date('2018-12-19T23:00:00.000Z'),
                        'duration': 122.6,
                        'original': {
                            'uri': null, 'puid': 'fmt/141'
                        },
                        'access': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-audio/objects/843d35b3-6ad8-4e33-9e3c-e5b25b13fde7-test_1.mp3'),
                            'puid': 'fmt/134'
                        },
                        'id': '843d35b3-6ad8-4e33-9e3c-e5b25b13fde7',
                        'collection_id': 'test',
                        'label': 'test_1.wav'
                    }), createItem({
                        'parent_id': 'test', 'parent_ids': ['test'], 'type': 'audio', 'size': 26169544,
                        'created_at': new Date('2018-12-19T23:00:00.000Z'), 'duration': 148.353, 'original': {
                            'uri': null, 'puid': 'fmt/141'
                        }, 'access': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-audio/objects/171b4119-baed-4423-8e32-c1f37cc230c9-test_2.mp3'),
                            'puid': 'fmt/134'
                        }, 'id': '171b4119-baed-4423-8e32-c1f37cc230c9', 'collection_id': 'test', 'label': 'test_2.wav'
                    })
                ]);
            });

            it('should return valid items for a digitized video collection', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/digitized-video');
                const {rootItem, childItems, textItems} = await processCollection(path, {type: 'root'});

                expect(textItems).to.be.empty;
                expect(rootItem).to.deep.equal(createItem({
                    'type': 'root',
                    'id': 'test',
                    'collection_id': 'test',
                    'label': 'test'
                }));
                expect(childItems).to.deep.equal([
                    createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'video',
                        'size': 13541802540,
                        'created_at': new Date('2018-07-05T22:00:00.000Z'),
                        'width': 1920,
                        'height': 1080,
                        'duration': 8266.72,
                        'original': {
                            'uri': null, 'puid': 'x-fmt/384'
                        },
                        'access': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/digitized-video/objects/f294d9ea-edfc-45b2-8a42-6d792d860955-test_001.mp4'),
                            'puid': 'fmt/199'
                        },
                        'id': 'f294d9ea-edfc-45b2-8a42-6d792d860955',
                        'collection_id': 'test',
                        'label': 'test_001.mov'
                    })
                ]);
            });

            it('should return valid items for a premis v3 METS file', async () => {
                const path = join(testRootDirectory, 'test-archivematica-collections/premis-v3');
                const {rootItem, childItems, textItems} = await processCollection(path, {type: 'root'});

                expect(textItems).to.be.empty;
                expect(rootItem).to.deep.equal(createItem({
                    'type': 'root',
                    'id': 'test',
                    'collection_id': 'test',
                    'label': 'test'
                }));
                expect(childItems).to.deep.equal([
                    createItem({
                        'parent_id': 'test',
                        'parent_ids': ['test'],
                        'type': 'image',
                        'size': 64600916,
                        'created_at': new Date('2019-01-16T23:00:00.000Z'),
                        'width': 3855,
                        'height': 5584,
                        'resolution': 800,
                        'original': {
                            'uri': join(testRootDirectory, 'test-archivematica-collections/premis-v3/objects/916cceb5-12c5-43c1-a98e-acf1647d1aca-test_0001.tif'),
                            'puid': 'fmt/353'
                        },
                        'id': 'C969A354-284F-4ECB-BAA6-62C24DF72643',
                        'collection_id': 'test',
                        'label': 'test_0001.tif'
                    })
                ]);
            });
        });
    });

    describe('#getIdentifier()', () => {
        it('should prefer the identifier of a handle over an UUID', () => {
            const premisElem = parseXml(`
                <premis:object xmlns:premis="info:lc/xmlns/premis-v2" xsi:type="premis:file"
                xsi:schemaLocation="info:lc/xmlns/premis-v2 http://www.loc.gov/standards/premis/v2/premis-v2-2.xsd"
                version="2.2">
                    <premis:objectIdentifier>
                        <premis:objectIdentifierType>UUID</premis:objectIdentifierType>
                        <premis:objectIdentifierValue>cf34ab26-d4a2-4b73-99bf-9da8171084b0</premis:objectIdentifierValue>
                    </premis:objectIdentifier>
                    <premis:objectIdentifier>
                        <premis:objectIdentifierType>hdl</premis:objectIdentifierType>
                        <premis:objectIdentifierValue>10622/12345</premis:objectIdentifierValue>
                    </premis:objectIdentifier>
                </premis:object>
            `).root() as Element;

            const identifier = getIdentifier(premisElem);

            expect(identifier).to.equal('12345');
        });

        it('should prefer the UUID identifier over anything else (if not a handle)', () => {
            const premisElem = parseXml(`
                <premis:object xmlns:premis="info:lc/xmlns/premis-v2" xsi:type="premis:file"
                xsi:schemaLocation="info:lc/xmlns/premis-v2 http://www.loc.gov/standards/premis/v2/premis-v2-2.xsd"
                version="2.2">
                    <premis:objectIdentifier>
                        <premis:objectIdentifierType>UUID</premis:objectIdentifierType>
                        <premis:objectIdentifierValue>cf34ab26-d4a2-4b73-99bf-9da8171084b0</premis:objectIdentifierValue>
                    </premis:objectIdentifier>
                    <premis:objectIdentifier>
                        <premis:objectIdentifierType>another-type-of-identifier</premis:objectIdentifierType>
                        <premis:objectIdentifierValue>abcdef</premis:objectIdentifierValue>
                    </premis:objectIdentifier>
                </premis:object>
            `).root() as Element;

            const identifier = getIdentifier(premisElem);

            expect(identifier).to.equal('cf34ab26-d4a2-4b73-99bf-9da8171084b0');
        });

        it('should fail to return an identifier if there is neither an UUID or handle', () => {
            const premisElem = parseXml(`
                <premis:object xmlns:premis="info:lc/xmlns/premis-v2" xsi:type="premis:file"
                xsi:schemaLocation="info:lc/xmlns/premis-v2 http://www.loc.gov/standards/premis/v2/premis-v2-2.xsd"
                version="2.2">
                    <premis:objectIdentifier>
                        <premis:objectIdentifierType>another-type-of-identifier</premis:objectIdentifierType>
                        <premis:objectIdentifierValue>abcdef</premis:objectIdentifierValue>
                    </premis:objectIdentifier>
                </premis:object>
            `).root() as Element;

            const identifier = getIdentifier(premisElem);

            expect(identifier).to.be.null;
        });
    });

    describe('#determineResolution()', () => {
        it('should correctly obtain the resolution from MediaInfo', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
                <MediaInfo xmlns="https://mediaarea.net/mediainfo" xsi:schemaLocation="https://mediaarea.net/mediainfo https://mediaarea.net/mediainfo/mediainfo_2_0.xsd" version="2.0">
                  <creatingLibrary version="18.03" url="https://mediaarea.net/MediaInfo">MediaInfoLib</creatingLibrary>
                  <media>
                    <track type="General">
                      <VideoCount>1</VideoCount>
                      <AudioCount>1</AudioCount>
                      <FileExtension>avi</FileExtension>
                      <Format>AVI</Format>
                      <Format_Commercial_IfAny>DVCPRO</Format_Commercial_IfAny>
                      <Format_Profile>OpenDML</Format_Profile>
                      <Interleaved>Yes</Interleaved>
                      <FileSize>2176917504</FileSize>
                      <Duration>573.960</Duration>
                      <OverallBitRate_Mode>CBR</OverallBitRate_Mode>
                      <OverallBitRate>30342428</OverallBitRate>
                      <FrameRate>25.000</FrameRate>
                      <StreamSize>472704</StreamSize>
                      <File_Modified_Date>UTC 2018-12-12 11:09:09</File_Modified_Date>
                      <File_Modified_Date_Local>2018-12-12 11:09:09</File_Modified_Date_Local>
                      <extra>
                        <IsTruncated>Yes</IsTruncated>
                      </extra>
                    </track>
                    <track type="Video">
                      <StreamOrder>0</StreamOrder>
                      <ID>0</ID>
                      <Format>DV</Format>
                      <Format_Commercial_IfAny>DVCPRO</Format_Commercial_IfAny>
                      <CodecID>dvsd</CodecID>
                      <Duration>573.960</Duration>
                      <BitRate_Mode>CBR</BitRate_Mode>
                      <BitRate>24441600</BitRate>
                      <BitRate_Encoded>28800000</BitRate_Encoded>
                      <Width>720</Width>
                      <Height>576</Height>
                      <PixelAspectRatio>1.067</PixelAspectRatio>
                      <DisplayAspectRatio>1.333</DisplayAspectRatio>
                      <FrameRate_Mode>CFR</FrameRate_Mode>
                      <FrameRate>25.000</FrameRate>
                      <FrameCount>14349</FrameCount>
                      <Standard>PAL</Standard>
                      <ColorSpace>YUV</ColorSpace>
                      <ChromaSubsampling>4:2:0</ChromaSubsampling>
                      <BitDepth>8</BitDepth>
                      <ScanType>Interlaced</ScanType>
                      <ScanOrder>BFF</ScanOrder>
                      <Compression_Mode>Lossy</Compression_Mode>
                      <Delay>0.000</Delay>
                      <TimeCode_FirstFrame>00:00:06:18</TimeCode_FirstFrame>
                      <TimeCode_Source>Subcode time code</TimeCode_Source>
                      <StreamSize>2066256000</StreamSize>
                    </track>
                    <track type="Audio">
                      <StreamOrder>1</StreamOrder>
                      <ID>1</ID>
                      <Format>PCM</Format>
                      <Format_Settings_Endianness>Little</Format_Settings_Endianness>
                      <Format_Settings_Sign>Signed</Format_Settings_Sign>
                      <CodecID>1</CodecID>
                      <Duration>573.900</Duration>
                      <BitRate_Mode>CBR</BitRate_Mode>
                      <BitRate>1536000</BitRate>
                      <Channels>2</Channels>
                      <SamplingRate>48000</SamplingRate>
                      <SamplingCount>27547200</SamplingCount>
                      <BitDepth>16</BitDepth>
                      <Delay>0.000</Delay>
                      <Delay_Source>Stream</Delay_Source>
                      <StreamSize>110188800</StreamSize>
                      <StreamSize_Proportion>0.05062</StreamSize_Proportion>
                      <Alignment>Aligned</Alignment>
                      <Interleave_VideoFrames>5.10</Interleave_VideoFrames>
                      <Interleave_Duration>0.204</Interleave_Duration>
                    </track>
                  </media>
                </MediaInfo>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const resolution = determineResolution(objCharsExtElem);

            expect(resolution).to.deep.equal({width: 720, height: 576});
        });

        it('should correctly obtain the resolution from FFprobe', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
                <ffprobe>
                  <program_version version="3.3.2-1~16.04.york2" copyright="Copyright (c) 2007-2017 the FFmpeg developers" compiler_ident="gcc 5.4.0 (Ubuntu 5.4.0-6ubuntu1~16.04.4) 20160609" configuration="--prefix=/usr --extra-version='1~16.04.york2' --toolchain=hardened --libdir=/usr/lib/x86_64-linux-gnu --incdir=/usr/include/x86_64-linux-gnu --enable-gpl --disable-stripping --enable-avresample --enable-avisynth --enable-gnutls --enable-ladspa --enable-libass --enable-libbluray --enable-libbs2b --enable-libcaca --enable-libcdio --enable-libflite --enable-libfontconfig --enable-libfreetype --enable-libfribidi --enable-libgme --enable-libgsm --enable-libmp3lame --enable-libopenjpeg --enable-libopenmpt --enable-libopus --enable-libpulse --enable-librubberband --enable-libshine --enable-libsnappy --enable-libsoxr --enable-libspeex --enable-libssh --enable-libtheora --enable-libtwolame --enable-libvorbis --enable-libvpx --enable-libwavpack --enable-libwebp --enable-libx265 --enable-libxvid --enable-libzmq --enable-libzvbi --enable-omx --enable-openal --enable-opengl --enable-sdl2 --enable-libdc1394 --enable-libiec61883 --enable-chromaprint --enable-frei0r --enable-libopencv --enable-libx264 --enable-shared"/>
                  <library_versions>
                    <library_version name="libavutil" major="55" minor="58" micro="100" version="3619428" ident="Lavu55.58.100"/>
                    <library_version name="libavcodec" major="57" minor="89" micro="100" version="3758436" ident="Lavc57.89.100"/>
                    <library_version name="libavformat" major="57" minor="71" micro="100" version="3753828" ident="Lavf57.71.100"/>
                    <library_version name="libavdevice" major="57" minor="6" micro="100" version="3737188" ident="Lavd57.6.100"/>
                    <library_version name="libavfilter" major="6" minor="82" micro="100" version="414308" ident="Lavfi6.82.100"/>
                    <library_version name="libswscale" major="4" minor="6" micro="100" version="263780" ident="SwS4.6.100"/>
                    <library_version name="libswresample" major="2" minor="7" micro="100" version="132964" ident="SwR2.7.100"/>
                    <library_version name="libpostproc" major="54" minor="5" micro="100" version="3540324" ident="postproc54.5.100"/>
                  </library_versions>
                  <streams>
                    <stream index="0" codec_name="dvvideo" codec_long_name="DV (Digital Video)" codec_type="video" codec_time_base="1/25" codec_tag_string="dvsd" codec_tag="0x64737664" width="720" height="576" coded_width="720" coded_height="576" has_b_frames="0" sample_aspect_ratio="16:15" display_aspect_ratio="4:3" pix_fmt="yuv420p" level="-99" chroma_location="topleft" refs="1" r_frame_rate="25/1" avg_frame_rate="25/1" time_base="1/25" start_pts="0" start_time="0.000000" duration_ts="14349" duration="573.960000" bit_rate="28802007" nb_frames="14349" extradata=" 00000000: 2c00 0000 1800 0000 0000 0000 0200 0000  ,............... 00000010: 0800 0000 0200 0000 0100 0000            ............ ">
                      <disposition default="0" dub="0" original="0" comment="0" lyrics="0" karaoke="0" forced="0" hearing_impaired="0" visual_impaired="0" clean_effects="0" attached_pic="0" timed_thumbnails="0"/>
                    </stream>
                    <stream index="1" codec_name="pcm_s16le" codec_long_name="PCM signed 16-bit little-endian" codec_type="audio" codec_time_base="1/48000" codec_tag_string="[1][0][0][0]" codec_tag="0x0001" sample_fmt="s16" sample_rate="48000" channels="2" bits_per_sample="16" r_frame_rate="0/0" avg_frame_rate="0/0" time_base="1/48000" start_pts="0" start_time="0.000000" bit_rate="1536000" nb_frames="27547200" extradata=" ">
                      <disposition default="0" dub="0" original="0" comment="0" lyrics="0" karaoke="0" forced="0" hearing_impaired="0" visual_impaired="0" clean_effects="0" attached_pic="0" timed_thumbnails="0"/>
                    </stream>
                  </streams>
                  <chapters></chapters>
                  <format nb_streams="2" nb_programs="0" format_name="avi" format_long_name="AVI (Audio Video Interleaved)" start_time="0.000000" duration="573.960000" size="2176917504" bit_rate="30342428" probe_score="100"/>
                </ffprobe>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const resolution = determineResolution(objCharsExtElem);

            expect(resolution).to.deep.equal({width: 720, height: 576});
        });

        it('should correctly obtain the resolution from the EXIF tool', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
                <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
                  <rdf:Description xmlns:et="http://ns.exiftool.ca/1.0/" xmlns:ExifTool="http://ns.exiftool.ca/ExifTool/1.0/" xmlns:File="http://ns.exiftool.ca/File/1.0/" xmlns:RIFF="http://ns.exiftool.ca/RIFF/RIFF/1.0/" xmlns:Composite="http://ns.exiftool.ca/Composite/1.0/" et:toolkit="Image::ExifTool 10.10">
                    <ExifTool:ExifToolVersion>10.10</ExifTool:ExifToolVersion>
                    <File:FileType>AVI</File:FileType>
                    <File:FileTypeExtension>avi</File:FileTypeExtension>
                    <File:MIMEType>video/x-msvideo</File:MIMEType>
                    <File:ImageWidth>720</File:ImageWidth>
                    <File:ImageHeight>576</File:ImageHeight>
                    <File:Planes>1</File:Planes>
                    <File:BitDepth>24</File:BitDepth>
                    <File:Compression>dvsd</File:Compression>
                    <File:ImageLength>1244160</File:ImageLength>
                    <File:PixelsPerMeterX>0</File:PixelsPerMeterX>
                    <File:PixelsPerMeterY>0</File:PixelsPerMeterY>
                    <File:NumColors>Use BitDepth</File:NumColors>
                    <File:NumImportantColors>All</File:NumImportantColors>
                    <RIFF:FrameRate>25</RIFF:FrameRate>
                    <RIFF:MaxDataRate>3516 kB/s</RIFF:MaxDataRate>
                    <RIFF:FrameCount>7049</RIFF:FrameCount>
                    <RIFF:StreamCount>2</RIFF:StreamCount>
                    <RIFF:ImageWidth>720</RIFF:ImageWidth>
                    <RIFF:ImageHeight>576</RIFF:ImageHeight>
                    <RIFF:StreamType>Video</RIFF:StreamType>
                    <RIFF:VideoCodec>dvsd</RIFF:VideoCodec>
                    <RIFF:VideoFrameRate>25</RIFF:VideoFrameRate>
                    <RIFF:VideoFrameCount>14349</RIFF:VideoFrameCount>
                    <RIFF:Quality>10000</RIFF:Quality>
                    <RIFF:SampleSize>Variable</RIFF:SampleSize>
                    <RIFF:StreamType>Audio</RIFF:StreamType>
                    <RIFF:AudioCodec/>
                    <RIFF:AudioSampleRate>48000</RIFF:AudioSampleRate>
                    <RIFF:AudioSampleCount>27547200</RIFF:AudioSampleCount>
                    <RIFF:Quality>10000</RIFF:Quality>
                    <RIFF:SampleSize>4 bytes</RIFF:SampleSize>
                    <RIFF:Encoding>Microsoft PCM</RIFF:Encoding>
                    <RIFF:NumChannels>2</RIFF:NumChannels>
                    <RIFF:SampleRate>48000</RIFF:SampleRate>
                    <RIFF:AvgBytesPerSec>192000</RIFF:AvgBytesPerSec>
                    <RIFF:BitsPerSample>16</RIFF:BitsPerSample>
                    <RIFF:TotalFrameCount>14349</RIFF:TotalFrameCount>
                    <Composite:Duration>0:04:41</Composite:Duration>
                    <Composite:ImageSize>720x576</Composite:ImageSize>
                    <Composite:Megapixels>0.415</Composite:Megapixels>
                  </rdf:Description>
                </rdf:RDF>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const resolution = determineResolution(objCharsExtElem);

            expect(resolution).to.deep.equal({width: 720, height: 576});
        });

        it('should correctly obtain the resolution from FITS (EXIF tool)', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
                <fits xmlns="http://hul.harvard.edu/ois/xml/ns/fits/fits_output" xsi:schemaLocation="http://hul.harvard.edu/ois/xml/ns/fits/fits_output http://hul.harvard.edu/ois/xml/xsd/fits/fits_output.xsd" version="0.8.4" timestamp="8/9/18 10:15 AM">
                  <identification>
                    <identity format="Exchangeable Image File Format" mimetype="image/jpeg" toolname="FITS" toolversion="0.8.4">
                      <tool toolname="Exiftool" toolversion="9.13"/>
                    </identity>
                  </identification>
                  <toolOutput>
                    <tool name="Exiftool" version="9.13">
                      <exiftool xmlns="">
                        <ExifToolVersion>9.13</ExifToolVersion>
                        <FileType>JPEG</FileType>
                        <MIMEType>image/jpeg</MIMEType>
                        <ExifByteOrder>Big-endian (Motorola, MM)</ExifByteOrder>
                        <Make>SONY</Make>
                        <Model>DSC-W180</Model>
                        <Orientation>Horizontal (normal)</Orientation>
                        <XResolution>72</XResolution>
                        <YResolution>72</YResolution>
                        <ResolutionUnit>inches</ResolutionUnit>
                        <ModifyDate>2010:01:24 14:49:43</ModifyDate>
                        <YCbCrPositioning>Co-sited</YCbCrPositioning>
                        <ExposureTime>1/100</ExposureTime>
                        <FNumber>3.1</FNumber>
                        <ExposureProgram>Landscape</ExposureProgram>
                        <ISO>100</ISO>
                        <ExifVersion>0221</ExifVersion>
                        <DateTimeOriginal>2010:01:24 14:49:43</DateTimeOriginal>
                        <CreateDate>2010:01:24 14:49:43</CreateDate>
                        <ComponentsConfiguration>Y, Cb, Cr, -</ComponentsConfiguration>
                        <CompressedBitsPerPixel>3</CompressedBitsPerPixel>
                        <ExposureCompensation>0</ExposureCompensation>
                        <MaxApertureValue>3.3</MaxApertureValue>
                        <MeteringMode>Multi-segment</MeteringMode>
                        <LightSource>Unknown</LightSource>
                        <Flash>Off, Did not fire</Flash>
                        <FocalLength>6.2 mm</FocalLength>
                        <CameraParameters>(Binary data 12000 bytes, use -b option to extract)</CameraParameters>
                        <FlashpixVersion>0100</FlashpixVersion>
                        <ColorSpace>sRGB</ColorSpace>
                        <ExifImageWidth>3648</ExifImageWidth>
                        <ExifImageHeight>2736</ExifImageHeight>
                        <InteropIndex>R98 - DCF basic file (sRGB)</InteropIndex>
                        <InteropVersion>0100</InteropVersion>
                        <FileSource>Digital Camera</FileSource>
                        <SceneType>Directly photographed</SceneType>
                        <CustomRendered>Normal</CustomRendered>
                        <ExposureMode>Auto</ExposureMode>
                        <WhiteBalance>Auto</WhiteBalance>
                        <SceneCaptureType>Landscape</SceneCaptureType>
                        <Saturation>Normal</Saturation>
                        <Sharpness>Normal</Sharpness>
                        <PrintIMVersion>0300</PrintIMVersion>
                        <Compression>JPEG (old-style)</Compression>
                        <ThumbnailOffset>12944</ThumbnailOffset>
                        <ThumbnailLength>7330</ThumbnailLength>
                        <ImageWidth>3648</ImageWidth>
                        <ImageHeight>2736</ImageHeight>
                        <EncodingProcess>Baseline DCT, Huffman coding</EncodingProcess>
                        <BitsPerSample>8</BitsPerSample>
                        <ColorComponents>3</ColorComponents>
                        <YCbCrSubSampling>YCbCr4:2:2 (2 1)</YCbCrSubSampling>
                        <Aperture>3.1</Aperture>
                        <ImageSize>3648x2736</ImageSize>
                        <ShutterSpeed>1/100</ShutterSpeed>
                        <ThumbnailImage>(Binary data 7330 bytes, use -b option to extract)</ThumbnailImage>
                        <FocalLength35efl>6.2 mm</FocalLength35efl>
                        <LightValue>9.9</LightValue>
                      </exiftool>
                    </tool>
                  </toolOutput>
                </fits>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const resolution = determineResolution(objCharsExtElem);

            expect(resolution).to.deep.equal({width: 3648, height: 2736});
        });
    });

    describe('#determineDpi()', () => {
        it('should correctly obtain the DPI from the EXIF tool', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
                <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
                  <rdf:Description xmlns:et="http://ns.exiftool.ca/1.0/" xmlns:ExifTool="http://ns.exiftool.ca/ExifTool/1.0/" xmlns:File="http://ns.exiftool.ca/File/1.0/" xmlns:IFD0="http://ns.exiftool.ca/EXIF/IFD0/1.0/" xmlns:ExifIFD="http://ns.exiftool.ca/EXIF/ExifIFD/1.0/" et:toolkit="Image::ExifTool 10.10">
                    <ExifTool:ExifToolVersion>10.10</ExifTool:ExifToolVersion>
                    <File:FileType>JPEG</File:FileType>
                    <File:FileTypeExtension>jpg</File:FileTypeExtension>
                    <File:MIMEType>image/jpeg</File:MIMEType>
                    <File:ExifByteOrder>Little-endian (Intel, II)</File:ExifByteOrder>
                    <File:Comment>AppleMark</File:Comment>
                    <File:ImageWidth>660</File:ImageWidth>
                    <File:ImageHeight>986</File:ImageHeight>
                    <File:EncodingProcess>Baseline DCT, Huffman coding</File:EncodingProcess>
                    <File:BitsPerSample>8</File:BitsPerSample>
                    <File:ColorComponents>3</File:ColorComponents>
                    <File:YCbCrSubSampling>YCbCr4:2:2 (2 1)</File:YCbCrSubSampling>
                    <IFD0:Make>NIKON CORPORATION</IFD0:Make>
                    <IFD0:Model>NIKON D3</IFD0:Model>
                    <IFD0:Orientation>Horizontal (normal)</IFD0:Orientation>
                    <IFD0:XResolution>300</IFD0:XResolution>
                    <IFD0:YResolution>300</IFD0:YResolution>
                    <IFD0:ResolutionUnit>inches</IFD0:ResolutionUnit>
                    <IFD0:Software>ACD Systems Digital Imaging</IFD0:Software>
                    <IFD0:ModifyDate>2009:06:18 10:10:20</IFD0:ModifyDate>
                    <IFD0:YCbCrPositioning>Centered</IFD0:YCbCrPositioning>
                    <ExifIFD:ExposureTime>1/125</ExifIFD:ExposureTime>
                    <ExifIFD:FNumber>16.0</ExifIFD:FNumber>
                    <ExifIFD:ExposureProgram>Manual</ExifIFD:ExposureProgram>
                    <ExifIFD:ISO>200</ExifIFD:ISO>
                    <ExifIFD:ExifVersion>0220</ExifIFD:ExifVersion>
                    <ExifIFD:DateTimeOriginal>2008:05:19 10:21:15</ExifIFD:DateTimeOriginal>
                    <ExifIFD:CreateDate>2008:05:19 10:21:15</ExifIFD:CreateDate>
                    <ExifIFD:ExposureCompensation>-1/3</ExifIFD:ExposureCompensation>
                    <ExifIFD:MaxApertureValue>2.8</ExifIFD:MaxApertureValue>
                    <ExifIFD:MeteringMode>Multi-segment</ExifIFD:MeteringMode>
                    <ExifIFD:LightSource>Flash</ExifIFD:LightSource>
                    <ExifIFD:Flash>No Flash</ExifIFD:Flash>
                    <ExifIFD:FocalLength>60.0 mm</ExifIFD:FocalLength>
                    <ExifIFD:UserComment/>
                    <ExifIFD:SubSecTime>396</ExifIFD:SubSecTime>
                    <ExifIFD:SubSecTimeOriginal>00</ExifIFD:SubSecTimeOriginal>
                    <ExifIFD:SubSecTimeDigitized>00</ExifIFD:SubSecTimeDigitized>
                    <ExifIFD:FlashpixVersion>0100</ExifIFD:FlashpixVersion>
                    <ExifIFD:ColorSpace>Uncalibrated</ExifIFD:ColorSpace>
                    <ExifIFD:ExifImageWidth>660</ExifIFD:ExifImageWidth>
                    <ExifIFD:ExifImageHeight>986</ExifIFD:ExifImageHeight>
                    <ExifIFD:SensingMethod>One-chip color area</ExifIFD:SensingMethod>
                    <ExifIFD:FileSource>Digital Camera</ExifIFD:FileSource>
                    <ExifIFD:SceneType>Directly photographed</ExifIFD:SceneType>
                    <ExifIFD:CFAPattern>[Red,Green][Green,Blue]</ExifIFD:CFAPattern>
                    <ExifIFD:CustomRendered>Normal</ExifIFD:CustomRendered>
                    <ExifIFD:ExposureMode>Manual</ExifIFD:ExposureMode>
                    <ExifIFD:WhiteBalance>Manual</ExifIFD:WhiteBalance>
                    <ExifIFD:DigitalZoomRatio>1</ExifIFD:DigitalZoomRatio>
                    <ExifIFD:FocalLengthIn35mmFormat>60 mm</ExifIFD:FocalLengthIn35mmFormat>
                    <ExifIFD:SceneCaptureType>Standard</ExifIFD:SceneCaptureType>
                    <ExifIFD:GainControl>None</ExifIFD:GainControl>
                    <ExifIFD:Contrast>Normal</ExifIFD:Contrast>
                    <ExifIFD:Saturation>Normal</ExifIFD:Saturation>
                    <ExifIFD:Sharpness>Normal</ExifIFD:Sharpness>
                    <ExifIFD:SubjectDistanceRange>Unknown</ExifIFD:SubjectDistanceRange>
                  </rdf:Description>
                </rdf:RDF>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const dpi = determineDpi(objCharsExtElem);

            expect(dpi).to.equal(300);
        });

        it('should correctly obtain the DPI from FITS (EXIF tool)', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
                <fits xmlns="http://hul.harvard.edu/ois/xml/ns/fits/fits_output" xsi:schemaLocation="http://hul.harvard.edu/ois/xml/ns/fits/fits_output http://hul.harvard.edu/ois/xml/xsd/fits/fits_output.xsd" version="0.8.4" timestamp="8/9/18 10:15 AM">
                  <identification>
                    <identity format="Exchangeable Image File Format" mimetype="image/jpeg" toolname="FITS" toolversion="0.8.4">
                      <tool toolname="Exiftool" toolversion="9.13"/>
                    </identity>
                  </identification>
                  <toolOutput>
                    <tool name="Exiftool" version="9.13">
                      <exiftool xmlns="">
                        <ExifToolVersion>9.13</ExifToolVersion>
                        <FileType>JPEG</FileType>
                        <MIMEType>image/jpeg</MIMEType>
                        <ExifByteOrder>Big-endian (Motorola, MM)</ExifByteOrder>
                        <Make>SONY</Make>
                        <Model>DSC-W180</Model>
                        <Orientation>Horizontal (normal)</Orientation>
                        <XResolution>72</XResolution>
                        <YResolution>72</YResolution>
                        <ResolutionUnit>inches</ResolutionUnit>
                        <ModifyDate>2010:01:24 14:49:43</ModifyDate>
                        <YCbCrPositioning>Co-sited</YCbCrPositioning>
                        <ExposureTime>1/100</ExposureTime>
                        <FNumber>3.1</FNumber>
                        <ExposureProgram>Landscape</ExposureProgram>
                        <ISO>100</ISO>
                        <ExifVersion>0221</ExifVersion>
                        <DateTimeOriginal>2010:01:24 14:49:43</DateTimeOriginal>
                        <CreateDate>2010:01:24 14:49:43</CreateDate>
                        <ComponentsConfiguration>Y, Cb, Cr, -</ComponentsConfiguration>
                        <CompressedBitsPerPixel>3</CompressedBitsPerPixel>
                        <ExposureCompensation>0</ExposureCompensation>
                        <MaxApertureValue>3.3</MaxApertureValue>
                        <MeteringMode>Multi-segment</MeteringMode>
                        <LightSource>Unknown</LightSource>
                        <Flash>Off, Did not fire</Flash>
                        <FocalLength>6.2 mm</FocalLength>
                        <CameraParameters>(Binary data 12000 bytes, use -b option to extract)</CameraParameters>
                        <FlashpixVersion>0100</FlashpixVersion>
                        <ColorSpace>sRGB</ColorSpace>
                        <ExifImageWidth>3648</ExifImageWidth>
                        <ExifImageHeight>2736</ExifImageHeight>
                        <InteropIndex>R98 - DCF basic file (sRGB)</InteropIndex>
                        <InteropVersion>0100</InteropVersion>
                        <FileSource>Digital Camera</FileSource>
                        <SceneType>Directly photographed</SceneType>
                        <CustomRendered>Normal</CustomRendered>
                        <ExposureMode>Auto</ExposureMode>
                        <WhiteBalance>Auto</WhiteBalance>
                        <SceneCaptureType>Landscape</SceneCaptureType>
                        <Saturation>Normal</Saturation>
                        <Sharpness>Normal</Sharpness>
                        <PrintIMVersion>0300</PrintIMVersion>
                        <Compression>JPEG (old-style)</Compression>
                        <ThumbnailOffset>12944</ThumbnailOffset>
                        <ThumbnailLength>7330</ThumbnailLength>
                        <ImageWidth>3648</ImageWidth>
                        <ImageHeight>2736</ImageHeight>
                        <EncodingProcess>Baseline DCT, Huffman coding</EncodingProcess>
                        <BitsPerSample>8</BitsPerSample>
                        <ColorComponents>3</ColorComponents>
                        <YCbCrSubSampling>YCbCr4:2:2 (2 1)</YCbCrSubSampling>
                        <Aperture>3.1</Aperture>
                        <ImageSize>3648x2736</ImageSize>
                        <ShutterSpeed>1/100</ShutterSpeed>
                        <ThumbnailImage>(Binary data 7330 bytes, use -b option to extract)</ThumbnailImage>
                        <FocalLength35efl>6.2 mm</FocalLength35efl>
                        <LightValue>9.9</LightValue>
                      </exiftool>
                    </tool>
                  </toolOutput>
                </fits>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const dpi = determineDpi(objCharsExtElem);

            expect(dpi).to.equal(72);
        });
    });

    describe('#determineDuration()', () => {
        it('should correctly obtain the duration from MediaInfo', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
                <MediaInfo xmlns="https://mediaarea.net/mediainfo" xsi:schemaLocation="https://mediaarea.net/mediainfo https://mediaarea.net/mediainfo/mediainfo_2_0.xsd" version="2.0">
                  <creatingLibrary version="18.03" url="https://mediaarea.net/MediaInfo">MediaInfoLib</creatingLibrary>
                  <media>
                    <track type="General">
                      <VideoCount>1</VideoCount>
                      <AudioCount>1</AudioCount>
                      <FileExtension>avi</FileExtension>
                      <Format>AVI</Format>
                      <Format_Commercial_IfAny>DVCPRO</Format_Commercial_IfAny>
                      <Format_Profile>OpenDML</Format_Profile>
                      <Interleaved>Yes</Interleaved>
                      <FileSize>2176917504</FileSize>
                      <Duration>573.960</Duration>
                      <OverallBitRate_Mode>CBR</OverallBitRate_Mode>
                      <OverallBitRate>30342428</OverallBitRate>
                      <FrameRate>25.000</FrameRate>
                      <StreamSize>472704</StreamSize>
                      <File_Modified_Date>UTC 2018-12-12 11:09:09</File_Modified_Date>
                      <File_Modified_Date_Local>2018-12-12 11:09:09</File_Modified_Date_Local>
                      <extra>
                        <IsTruncated>Yes</IsTruncated>
                      </extra>
                    </track>
                    <track type="Video">
                      <StreamOrder>0</StreamOrder>
                      <ID>0</ID>
                      <Format>DV</Format>
                      <Format_Commercial_IfAny>DVCPRO</Format_Commercial_IfAny>
                      <CodecID>dvsd</CodecID>
                      <Duration>573.960</Duration>
                      <BitRate_Mode>CBR</BitRate_Mode>
                      <BitRate>24441600</BitRate>
                      <BitRate_Encoded>28800000</BitRate_Encoded>
                      <Width>720</Width>
                      <Height>576</Height>
                      <PixelAspectRatio>1.067</PixelAspectRatio>
                      <DisplayAspectRatio>1.333</DisplayAspectRatio>
                      <FrameRate_Mode>CFR</FrameRate_Mode>
                      <FrameRate>25.000</FrameRate>
                      <FrameCount>14349</FrameCount>
                      <Standard>PAL</Standard>
                      <ColorSpace>YUV</ColorSpace>
                      <ChromaSubsampling>4:2:0</ChromaSubsampling>
                      <BitDepth>8</BitDepth>
                      <ScanType>Interlaced</ScanType>
                      <ScanOrder>BFF</ScanOrder>
                      <Compression_Mode>Lossy</Compression_Mode>
                      <Delay>0.000</Delay>
                      <TimeCode_FirstFrame>00:00:06:18</TimeCode_FirstFrame>
                      <TimeCode_Source>Subcode time code</TimeCode_Source>
                      <StreamSize>2066256000</StreamSize>
                    </track>
                    <track type="Audio">
                      <StreamOrder>1</StreamOrder>
                      <ID>1</ID>
                      <Format>PCM</Format>
                      <Format_Settings_Endianness>Little</Format_Settings_Endianness>
                      <Format_Settings_Sign>Signed</Format_Settings_Sign>
                      <CodecID>1</CodecID>
                      <Duration>573.900</Duration>
                      <BitRate_Mode>CBR</BitRate_Mode>
                      <BitRate>1536000</BitRate>
                      <Channels>2</Channels>
                      <SamplingRate>48000</SamplingRate>
                      <SamplingCount>27547200</SamplingCount>
                      <BitDepth>16</BitDepth>
                      <Delay>0.000</Delay>
                      <Delay_Source>Stream</Delay_Source>
                      <StreamSize>110188800</StreamSize>
                      <StreamSize_Proportion>0.05062</StreamSize_Proportion>
                      <Alignment>Aligned</Alignment>
                      <Interleave_VideoFrames>5.10</Interleave_VideoFrames>
                      <Interleave_Duration>0.204</Interleave_Duration>
                    </track>
                  </media>
                </MediaInfo>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const duration = determineDuration(objCharsExtElem);

            expect(duration).to.equal(573.96);
        });

        it('should correctly obtain the duration from FFprobe', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
                <ffprobe>
                  <program_version version="3.3.2-1~16.04.york2" copyright="Copyright (c) 2007-2017 the FFmpeg developers" compiler_ident="gcc 5.4.0 (Ubuntu 5.4.0-6ubuntu1~16.04.4) 20160609" configuration="--prefix=/usr --extra-version='1~16.04.york2' --toolchain=hardened --libdir=/usr/lib/x86_64-linux-gnu --incdir=/usr/include/x86_64-linux-gnu --enable-gpl --disable-stripping --enable-avresample --enable-avisynth --enable-gnutls --enable-ladspa --enable-libass --enable-libbluray --enable-libbs2b --enable-libcaca --enable-libcdio --enable-libflite --enable-libfontconfig --enable-libfreetype --enable-libfribidi --enable-libgme --enable-libgsm --enable-libmp3lame --enable-libopenjpeg --enable-libopenmpt --enable-libopus --enable-libpulse --enable-librubberband --enable-libshine --enable-libsnappy --enable-libsoxr --enable-libspeex --enable-libssh --enable-libtheora --enable-libtwolame --enable-libvorbis --enable-libvpx --enable-libwavpack --enable-libwebp --enable-libx265 --enable-libxvid --enable-libzmq --enable-libzvbi --enable-omx --enable-openal --enable-opengl --enable-sdl2 --enable-libdc1394 --enable-libiec61883 --enable-chromaprint --enable-frei0r --enable-libopencv --enable-libx264 --enable-shared"/>
                  <library_versions>
                    <library_version name="libavutil" major="55" minor="58" micro="100" version="3619428" ident="Lavu55.58.100"/>
                    <library_version name="libavcodec" major="57" minor="89" micro="100" version="3758436" ident="Lavc57.89.100"/>
                    <library_version name="libavformat" major="57" minor="71" micro="100" version="3753828" ident="Lavf57.71.100"/>
                    <library_version name="libavdevice" major="57" minor="6" micro="100" version="3737188" ident="Lavd57.6.100"/>
                    <library_version name="libavfilter" major="6" minor="82" micro="100" version="414308" ident="Lavfi6.82.100"/>
                    <library_version name="libswscale" major="4" minor="6" micro="100" version="263780" ident="SwS4.6.100"/>
                    <library_version name="libswresample" major="2" minor="7" micro="100" version="132964" ident="SwR2.7.100"/>
                    <library_version name="libpostproc" major="54" minor="5" micro="100" version="3540324" ident="postproc54.5.100"/>
                  </library_versions>
                  <streams>
                    <stream index="0" codec_name="dvvideo" codec_long_name="DV (Digital Video)" codec_type="video" codec_time_base="1/25" codec_tag_string="dvsd" codec_tag="0x64737664" width="720" height="576" coded_width="720" coded_height="576" has_b_frames="0" sample_aspect_ratio="16:15" display_aspect_ratio="4:3" pix_fmt="yuv420p" level="-99" chroma_location="topleft" refs="1" r_frame_rate="25/1" avg_frame_rate="25/1" time_base="1/25" start_pts="0" start_time="0.000000" duration_ts="14349" duration="573.960000" bit_rate="28802007" nb_frames="14349" extradata=" 00000000: 2c00 0000 1800 0000 0000 0000 0200 0000  ,............... 00000010: 0800 0000 0200 0000 0100 0000            ............ ">
                      <disposition default="0" dub="0" original="0" comment="0" lyrics="0" karaoke="0" forced="0" hearing_impaired="0" visual_impaired="0" clean_effects="0" attached_pic="0" timed_thumbnails="0"/>
                    </stream>
                    <stream index="1" codec_name="pcm_s16le" codec_long_name="PCM signed 16-bit little-endian" codec_type="audio" codec_time_base="1/48000" codec_tag_string="[1][0][0][0]" codec_tag="0x0001" sample_fmt="s16" sample_rate="48000" channels="2" bits_per_sample="16" r_frame_rate="0/0" avg_frame_rate="0/0" time_base="1/48000" start_pts="0" start_time="0.000000" bit_rate="1536000" nb_frames="27547200" extradata=" ">
                      <disposition default="0" dub="0" original="0" comment="0" lyrics="0" karaoke="0" forced="0" hearing_impaired="0" visual_impaired="0" clean_effects="0" attached_pic="0" timed_thumbnails="0"/>
                    </stream>
                  </streams>
                  <chapters></chapters>
                  <format nb_streams="2" nb_programs="0" format_name="avi" format_long_name="AVI (Audio Video Interleaved)" start_time="0.000000" duration="573.960000" size="2176917504" bit_rate="30342428" probe_score="100"/>
                </ffprobe>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const duration = determineDuration(objCharsExtElem);

            expect(duration).to.equal(573.96);
        });
    });

    describe('#determineEncoding()', () => {
        it('should correctly obtain the duration from Fits / Tika', () => {
            const objCharsExtElem = parseXml(`
              <premis:objectCharacteristicsExtension>
               <fits xmlns="http://hul.harvard.edu/ois/xml/ns/fits/fits_output" xsi:schemaLocation="http://hul.harvard.edu/ois/xml/ns/fits/fits_output http://hul.harvard.edu/ois/xml/xsd/fits/fits_output.xsd" version="1.1.0">
                <toolOutput>
                  <tool name="Tika" version="1.10">
                    <metadata xmlns="">
                      <field name="Content-Encoding">
                        <value>ISO-8859-1</value>
                      </field>
                    </metadata>
                  </tool>
                </toolOutput>
               </fits>
              </premis:objectCharacteristicsExtension>
            `).root() as Element;

            const encoding = determineEncoding(objCharsExtElem);
            expect(encoding).to.equal('ISO-8859-1');
        });
    });
});