import {Manifest, Collection} from '@archival-iiif/presentation-builder/v3';

import {getChildItems} from '../lib/Item.ts';
import type {Item, MetadataItem} from '../lib/ItemInterfaces.ts';

import {createMinimalCollection, createCollection, addMetadata} from './PresentationUtils.ts';
import {runLib} from '../lib/Task.ts';

import type {BasicIIIFMetadata, ItemParams} from '../lib/ServiceTypes.ts';
import type {PresentationBuilder} from './PresentationBuilder.ts';

export async function getCollection(item: MetadataItem, builder: PresentationBuilder): Promise<Collection> {
    const collection = await createCollection(item);
    const children = await getChildItems(item);

    const md = await runLib<ItemParams, BasicIIIFMetadata>('basic-iiif-metadata', {item});
    await addMetadata(collection, item, md);
    collection.setBehavior('multi-part');

    collection.setItems(await Promise.all(children.map(async child =>
        await builder.getReference(child) as Collection | Manifest)));

    return collection;
}

export async function getCollectionWithChildren(item: MetadataItem, children: Item[],
                                                builder: PresentationBuilder): Promise<Collection> {
    const collection = await createCollection(item);

    const md = await runLib<ItemParams, BasicIIIFMetadata>('basic-iiif-metadata', {item});
    await addMetadata(collection, item, md);

    collection.setItems(await Promise.all(children.map(async child =>
        await builder.getReference(child) as Collection | Manifest)));

    return collection;
}

export async function getReference(item: MetadataItem): Promise<Collection> {
    return createMinimalCollection(item);
}
