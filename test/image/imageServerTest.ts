import {expect} from 'chai';
import {Buffer} from 'buffer';
import {MockAgent, setGlobalDispatcher} from 'undici';

import {setConfig} from '../../src/lib/Config.ts';
import {createItem} from '../../src/lib/Item.ts';

import type {ImageItem} from '../../src/lib/ItemInterfaces.ts';

import {getImage} from '../../src/image/imageServer.ts';

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

    setConfig('collectionsRelativePath', 'collections');

    describe('#getImage()', () => {
        const image = Buffer.from('image');

        beforeEach(() => {
            const mockAgent = new MockAgent();
            mockAgent.get('http://localhost:8080').intercept({
                method: 'GET',
                path: path => path.startsWith(`/${encodeURIComponent('collections/' + item.access.uri)}`),
            }).reply(200, image, {
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': '500'
                }
            });
            setGlobalDispatcher(mockAgent);
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