import * as Metadata from './Metadata';
import * as Digitized from './Digitized';
import * as DigitalBorn from './DigitalBorn';

import {Access} from '../lib/Security';
import {FileItem, FolderItem, Item, MetadataItem, RootItem} from '../lib/ItemInterfaces';

import Collection from './elem/v3/Collection';
import Manifest from './elem/v3/Manifest';

export interface PresentationBuilder {
    isCollection: (item: Item | null) => boolean;
    isManifest: (item: Item | null) => boolean;
    getCollection: (item: Item, access: Access) => Promise<Collection | null>;
    getManifest: (item: Item, access: Access) => Promise<Manifest | null>;
    getReference: (item: Item) => Promise<Collection | Manifest | null>;
}

export const isCollection = (item: Item | null): boolean =>
    item !== null && (item.type === 'metadata' || item.type === 'folder');

export const isManifest = (item: Item | null): boolean =>
    item !== null && (item.type !== 'metadata' && item.type !== 'folder' && (!item.order || item.type === 'root'));

export async function getCollection(item: Item, access: Access): Promise<Collection | null> {
    if (item && (item.type === 'metadata'))
        return await Metadata.getCollection(item as MetadataItem, builder);

    if (item && (item.type === 'folder'))
        return await DigitalBorn.getCollection(item as FolderItem, access, builder);

    return null;
}

export async function getCollectionWithChildren(item: MetadataItem, children: Item[]): Promise<Collection | null> {
    return await Metadata.getCollectionWithChildren(item, children, builder);
}

export async function getManifest(item: Item, access: Access): Promise<Manifest | null> {
    if (item && (item.type === 'root'))
        return await Digitized.getManifest(item as RootItem, access);

    if (item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order))
        return await DigitalBorn.getManifest(item as FileItem, access);

    return null;
}

export async function getReference(item: Item): Promise<Collection | Manifest | null> {
    if (item && (item.type === 'metadata'))
        return await Metadata.getReference(item as MetadataItem);

    if (item && (item.type === 'root'))
        return await Digitized.getReference(item as RootItem);

    if (item && ((item.type === 'folder') || !item.order))
        return await DigitalBorn.getReference(item as FileItem);

    return null;
}

const builder: PresentationBuilder = {isCollection, isManifest, getCollection, getManifest, getReference};
