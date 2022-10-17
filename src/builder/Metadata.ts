import {Manifest, Collection} from '@archival-iiif/presentation-builder/v3';

import {getChildItems} from '../lib/Item.js';
import {Item, MetadataItem} from '../lib/ItemInterfaces.js';

import {PresentationBuilder} from './PresentationBuilder.js';
import {createMinimalCollection, createCollection, addMetadata} from './PresentationUtils.js';
import {runLib} from '../lib/Task.js';
import {BasicIIIFMetadata, ItemParams} from '../lib/ServiceTypes.js';

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
