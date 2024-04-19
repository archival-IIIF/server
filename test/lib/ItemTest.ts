import sinon from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';

import {setConfig} from '../../src/lib/Config.js';
import {setElasticSearchClient} from '../../src/lib/ElasticSearch.js';

import {
    createItem, getAvailableType, getFullPath, getPronom, getRelativePath, indexItems, updateItems
} from '../../src/lib/Item.js';
import {Item, MinimalItem} from '../../src/lib/ItemInterfaces.js';

chai.use(sinonChai);
const expect = chai.expect;

describe('Item', () => {
    let elasticSearch: any;

    const dataPath = '/data';
    const collectionsPath = 'collections';

    const itemWithOriginal = {
        original: {uri: 'dip/with/original/file.txt', puid: 'fmt/org'},
        access: {uri: null, puid: null}
    } as Item;

    const itemWithBoth = {
        original: {uri: 'dip/with/both/original.txt', puid: 'fmt/original'},
        access: {uri: 'dip/with/both/access.txt', puid: 'fmt/access'}
    } as Item;

    beforeEach(() => {
        elasticSearch = {
            bulk: sinon.stub().resolves({})
        };

        setConfig('dataRootPath', dataPath);
        setConfig('collectionsRelativePath', collectionsPath);

        setElasticSearchClient(elasticSearch);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('#createItem()', () => {
        it('should create a valid Item object with predefined values', () => {
            const before = {
                id: '12345',
                collection_id: '67890',
                type: 'pdf',
                label: 'A label',
                original: {
                    uri: '/path/to/the/file.pdf',
                    puid: 'application/pdf'
                }
            };

            const after = {
                id: '12345',
                parent_id: null,
                parent_ids: [],
                range_ids: [],
                collection_id: '67890',
                metadata_id: null,
                type: 'pdf',
                formats: [],
                label: 'A label',
                description: null,
                authors: [],
                dates: [],
                physical: null,
                size: null,
                order: null,
                created_at: null,
                width: null,
                height: null,
                resolution: null,
                duration: null,
                metadata: [],
                original: {
                    uri: '/path/to/the/file.pdf',
                    puid: 'application/pdf'
                },
                access: {
                    uri: null,
                    puid: null
                }
            };

            const result = createItem(before);

            expect(result).to.deep.equals(after);
        });
    });

    describe('#indexItems()', () => {
        it('should send a valid bulk index action to ElasticSearch', async () => {
            const items = [{id: '123', label: 'A'}, {id: '456', label: 'B'}, {id: '789', label: 'C'}] as Item[];
            const operations = [
                {index: {_index: 'items', _id: '123'}},
                {id: '123', label: 'A'},
                {index: {_index: 'items', _id: '456'}},
                {id: '456', label: 'B'},
                {index: {_index: 'items', _id: '789'}},
                {id: '789', label: 'C'}
            ];

            await indexItems(items);

            expect(elasticSearch.bulk).to.have.been.calledWithExactly({refresh: 'wait_for', operations});
        });

        it('should send no bulk index action to ElasticSearch on empty input', async () => {
            await indexItems([]);
            expect(elasticSearch.bulk).to.not.have.been.called;
        });
    });

    describe('#updateItems()', () => {
        it('should send a valid bulk update action to ElasticSearch', async () => {
            const items = [{id: '123', label: 'A'}, {id: '456', label: 'B'}, {id: '789', label: 'C'}] as Item[];
            const operations = [
                {update: {_index: 'items', _id: '123'}},
                {
                    doc: {id: '123', label: 'A'},
                    upsert: createItem({id: '123', label: 'A'} as MinimalItem)
                },
                {update: {_index: 'items', _id: '456'}},
                {
                    doc: {id: '456', label: 'B'},
                    upsert: createItem({id: '456', label: 'B'} as MinimalItem)
                },
                {update: {_index: 'items', _id: '789'}},
                {
                    doc: {id: '789', label: 'C'},
                    upsert: createItem({id: '789', label: 'C'} as MinimalItem)
                },
            ];

            await updateItems(items);

            expect(elasticSearch.bulk).to.have.been.calledWithExactly({operations});
        });

        it('should send no bulk update action to ElasticSearch on empty input', async () => {
            await updateItems([]);
            expect(elasticSearch.bulk).to.not.have.been.called;
        });
    });

    describe('#getFullPath', () => {
        it('should return the original full path of the original uri', () => {
            const path = getFullPath(itemWithBoth, 'original');
            expect(path).to.equal('/data/collections/dip/with/both/original.txt');
        });

        it('should return the access full path of the access uri', () => {
            const path = getFullPath(itemWithBoth, 'access');
            expect(path).to.equal('/data/collections/dip/with/both/access.txt');
        });

        it('should return the full path of the access uri, as is prefers access', () => {
            const path = getFullPath(itemWithBoth);
            expect(path).to.equal('/data/collections/dip/with/both/access.txt');
        });

        it('should return the full path of the original uri, if there is no access', () => {
            const path = getFullPath(itemWithOriginal);
            expect(path).to.equal('/data/collections/dip/with/original/file.txt');
        });
    });

    describe('#getRelativePath', () => {
        it('should return the original relative path of the original uri', () => {
            const path = getRelativePath(itemWithBoth, 'original');
            expect(path).to.equal('collections/dip/with/both/original.txt');
        });

        it('should return the access relative path of the access uri', () => {
            const path = getRelativePath(itemWithBoth, 'access');
            expect(path).to.equal('collections/dip/with/both/access.txt');
        });

        it('should return the relative path of the access uri, as is prefers access', () => {
            const path = getRelativePath(itemWithBoth);
            expect(path).to.equal('collections/dip/with/both/access.txt');
        });

        it('should return the relative path of the original uri, if there is no access', () => {
            const path = getRelativePath(itemWithOriginal);
            expect(path).to.equal('collections/dip/with/original/file.txt');
        });
    });

    describe('#getPronom', () => {
        it('should return the PUID of the original uri', () => {
            const puid = getPronom(itemWithBoth, 'original');
            expect(puid).to.equal('fmt/original');
        });

        it('should return the PUID of the access uri', () => {
            const puid = getPronom(itemWithBoth, 'access');
            expect(puid).to.equal('fmt/access');
        });

        it('should return the PUID of the access uri, as is prefers access', () => {
            const puid = getPronom(itemWithBoth);
            expect(puid).to.equal('fmt/access');
        });

        it('should return the PUID of the original uri, if there is no access', () => {
            const puid = getPronom(itemWithOriginal);
            expect(puid).to.equal('fmt/org');
        });
    });

    describe('#getAvailableType', () => {
        it('should return the type \'access\', as is prefers access', () => {
            const type = getAvailableType(itemWithBoth);
            expect(type).to.equal('access');
        });

        it('should return the type \'original\', if there is no access', () => {
            const type = getAvailableType(itemWithOriginal);
            expect(type).to.equal('original');
        });
    });
});
