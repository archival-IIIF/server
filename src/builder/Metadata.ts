import {getChildItems} from '../lib/Item';
import {Item, MetadataItem} from '../lib/ItemInterfaces';

import {Ref} from './elem/v3/Base';
import Collection from './elem/v3/Collection';

import {PresentationBuilder} from './PresentationBuilder';
import {createMinimalCollection, createCollection, addMetadata} from './PresentationUtils';

export async function getCollection(item: MetadataItem, builder: PresentationBuilder): Promise<Collection> {
    const collection = await createCollection(item);
    const children = await getChildItems(item.id, true);

    await addMetadata(collection, item);
    collection.setBehavior('multi-part');

    collection.setItems(await Promise.all(children.map(async child =>
        await builder.getReference(child) as Ref)));

    return collection;
}

export async function getCollectionWithChildren(item: MetadataItem, children: Item[],
                                                builder: PresentationBuilder): Promise<Collection> {
    const collection = await createCollection(item);

    await addMetadata(collection, item);

    collection.setItems(await Promise.all(children.map(async child =>
        await builder.getReference(child) as Ref)));

    return collection;
}

export async function getReference(item: MetadataItem): Promise<Collection> {
    return createMinimalCollection(item);
}
