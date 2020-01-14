import {expect} from 'chai';
import * as nock from 'nock';
import {Buffer} from 'buffer';

import {createItem} from '../../src/lib/Item';
import {ImageItem} from '../../src/lib/ItemInterfaces';

import {getInfo, getImage} from '../../src/image/imageServer';
import Image, {AccessTier} from '../../src/presentation/elem/v2/Image';
import {setConfig} from '../../src/lib/Config';

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

    describe('#getInfo()', () => {
        const imageInfoKeys = ['@context', '@id', 'profile', 'protocol', 'width', 'height', 'sizes'];

        it('should generate an IIIF image info record for an image item', async () => {
            const imageInfo = await getInfo(item);

            expect(imageInfo).to.be.an.instanceOf(Image);
            expect(imageInfo).to.have.all.keys(imageInfoKeys);

            expect(imageInfo).to.have.nested.include({'profile[0]': 'http://iiif.io/api/image/2/level2.json'});
            expect(imageInfo).to.have.nested.property('profile[1].formats');
            expect(imageInfo).to.have.nested.property('profile[1].qualities');
            expect(imageInfo).to.have.nested.property('profile[1].supports');

            expect(imageInfo).to.have.deep.property('@context', 'http://iiif.io/api/image/2/context.json');
            expect(imageInfo).to.have.deep.property('@id', 'http://localhost:3000/iiif/image/12345');
            expect(imageInfo).to.have.deep.property('protocol', 'http://iiif.io/api/image');
            expect(imageInfo).to.have.deep.property('width', 500);
            expect(imageInfo).to.have.deep.property('height', 200);
            expect(imageInfo).to.have.deep.property('sizes', []);
        });

        it('should generate an IIIF image info record for an image item with tier', async () => {
            const imageInfo = await getInfo(item, tier);

            expect(imageInfo).to.be.an.instanceOf(Image);
            expect(imageInfo).to.have.all.keys([...imageInfoKeys, 'maxWidth', 'maxHeight']);

            expect(imageInfo).to.have.nested.include({'profile[0]': 'http://iiif.io/api/image/2/level2.json'});
            expect(imageInfo).to.have.nested.property('profile[1].formats');
            expect(imageInfo).to.have.nested.property('profile[1].qualities');
            expect(imageInfo).to.have.nested.property('profile[1].supports');

            expect(imageInfo).to.have.deep.property('@context', 'http://iiif.io/api/image/2/context.json');
            expect(imageInfo).to.have.deep.property('@id', 'http://localhost:3000/iiif/image/12345_tierName');
            expect(imageInfo).to.have.deep.property('protocol', 'http://iiif.io/api/image');
            expect(imageInfo).to.have.deep.property('width', 500);
            expect(imageInfo).to.have.deep.property('height', 200);
            expect(imageInfo).to.have.deep.property('sizes', []);

            expect(imageInfo).to.have.deep.property('maxWidth', 150);
            expect(imageInfo).to.have.deep.property('maxHeight', 60);

        });

        it('should generate an IIIF image info record for an image item with tier and original id', async () => {
            const imageInfo = await getInfo(item, tier, 'abc');

            expect(imageInfo).to.be.an.instanceOf(Image);
            expect(imageInfo).to.have.all.keys([...imageInfoKeys, 'maxWidth', 'maxHeight']);

            expect(imageInfo).to.have.nested.include({'profile[0]': 'http://iiif.io/api/image/2/level2.json'});
            expect(imageInfo).to.have.nested.property('profile[1].formats');
            expect(imageInfo).to.have.nested.property('profile[1].qualities');
            expect(imageInfo).to.have.nested.property('profile[1].supports');

            expect(imageInfo).to.have.deep.property('@context', 'http://iiif.io/api/image/2/context.json');
            expect(imageInfo).to.have.deep.property('@id', 'http://localhost:3000/iiif/image/abc_tierName');
            expect(imageInfo).to.have.deep.property('protocol', 'http://iiif.io/api/image');
            expect(imageInfo).to.have.deep.property('width', 500);
            expect(imageInfo).to.have.deep.property('height', 200);
            expect(imageInfo).to.have.deep.property('sizes', []);

            expect(imageInfo).to.have.deep.property('maxWidth', 150);
            expect(imageInfo).to.have.deep.property('maxHeight', 60);
        });
    });

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
            const result = await getImage(item, {
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