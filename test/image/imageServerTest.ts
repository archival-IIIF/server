import {expect} from 'chai';
import nock from 'nock';
import {Buffer} from 'buffer';
import {AccessTier} from '@archival-iiif/presentation-builder/v2';

import {setConfig} from '../../src/lib/Config.js';
import {createItem} from '../../src/lib/Item.js';
import {ImageItem} from '../../src/lib/ItemInterfaces.js';

import {getImage} from '../../src/image/imageServer.js';

describe('imageServer', () => {
    const item = createItem({
        id: '12345',
        collection_id: 'collection',
        parent_id: 'parent',
        label: 'Test image',
        type: 'image',
        size: 56789,
        created_at: new Date(),
        width: 500,
        height: 200,
        resolution: 60,
        access: {
            uri: 'some/path/to/an/image.tif',
            puid: 'fmt/353'
        }
    }) as ImageItem;

    const tier: AccessTier = {name: 'tierName', maxSize: 150};

    setConfig('collectionsRelativePath', 'collections');

    describe('#getImage()', () => {
        const image = Buffer.from('image');

        beforeEach(() => {
            nock('http://localhost:8080')
                .get(uri => uri.startsWith('/' + encodeURIComponent('collections/' + item.access.uri)))
                .reply(200, image, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': '500'
                });
        });

        it('should call an external IIIF image provider', async () => {
            const result = await getImage(item, null, null, {
                region: 'full',
                size: 'max',
                rotation: '0',
                quality: 'default',
                format: 'jpg'
            });

            expect(result).to.deep.equal({
                image: image,
                status: 200,
                contentType: 'image/jpeg',
                contentLength: 500
            });
        });
    });
});