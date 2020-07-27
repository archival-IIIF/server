import {getChildItems} from '../lib/Item';
import {Item, RootItem, FileItem} from '../lib/ItemInterfaces';

import {createMinimalManifest, createManifest, createCanvas, addThumbnail, addMetadata} from './PresentationUtils';

import Base from './elem/v3/Base';
import Manifest from './elem/v3/Manifest';

export async function getManifest(parentItem: RootItem): Promise<Manifest> {
    const manifest = await createManifest(parentItem);
    const items = await getChildItems(parentItem) as FileItem[];

    addBehavior(manifest, parentItem, items.length > 1);
    await addThumbnail(manifest, parentItem);
    await addMetadata(manifest, parentItem);

    manifest.setItems(await Promise.all(items.map(async (item, idx) => {
        const canvas = await createCanvas(item, parentItem, idx === 0);

        await addThumbnail(canvas, item);
        await addMetadata(canvas, item);

        return canvas;
    })));

    return manifest;
}

export async function getReference(item: RootItem): Promise<Manifest> {
    return createMinimalManifest(item);
}

function addBehavior(base: Base, item: Item, hasMultipleItems = true): void {
    base.setViewingDirection('left-to-right');

    if (hasMultipleItems && item.formats.includes('book'))
        base.setBehavior('paged');
    else
        base.setBehavior('individuals');
}
