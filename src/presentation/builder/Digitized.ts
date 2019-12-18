import {getChildItems} from '../../lib/Item';
import {Item, RootItem, FileItem} from '../../lib/ItemInterfaces';

import {createMinimalManifest, createManifest, createCanvas, addThumbnail, addMetadata} from './PresentationUtils';

import Base from '../elem/v3/Base';
import Manifest from '../elem/v3/Manifest';

export async function getManifest(parentItem: RootItem): Promise<Manifest> {
    const manifest = await createManifest(parentItem);
    const items = await getChildItems(parentItem.id, true) as FileItem[];
    const firstItem = items[0];

    addBehavior(manifest, parentItem, items.length > 1);
    addThumbnail(manifest, parentItem, firstItem);
    await addMetadata(manifest, parentItem);

    manifest.setItems(await Promise.all(items.map(async item => {
        const canvas = await createCanvas(item, parentItem);

        addThumbnail(canvas, item);
        await addMetadata(canvas, item);

        return canvas;
    })));

    return manifest;
}

export async function getReference(item: RootItem): Promise<Manifest> {
    const manifest = createMinimalManifest(item);

    const items = await getChildItems(item.id, true) as FileItem[];
    const firstItem = items[0];

    addThumbnail(manifest, firstItem);
    await addMetadata(manifest, item);

    return manifest;
}

function addBehavior(base: Base, item: Item, hasMultipleItems = true): void {
    base.setViewingDirection('left-to-right');

    if (hasMultipleItems && item.formats.includes('book'))
        base.setBehavior('paged');
    else
        base.setBehavior('individuals');
}
