import * as Metadata from './Metadata';
import * as Digitized from './Digitized';
import * as DigitalBorn from './DigitalBorn';

import * as MetadataV3 from './MetadataV3';
import * as DigitalBornV3 from './DigitalBornV3';

import {Access} from '../../lib/Security';
import {FileItem, FolderItem, Item, MetadataItem, RootItem} from '../../lib/ItemInterfaces';

import CollectionV2 from '../elem/v2/Collection';
import CollectionV3 from '../elem/v3/Collection';
import ManifestV2 from '../elem/v2/Manifest';
import ManifestV3 from '../elem/v3/Manifest';

export interface PresentationBuilder {
    isCollection: (item: Item | null) => boolean;
    isManifest: (item: Item | null) => boolean;
    getCollection: (item: Item, access: Access, v3?: string) => Promise<CollectionV2 | CollectionV3 | null>;
    getManifest: (item: Item, access: Access, v3?: string) => Promise<ManifestV2 | ManifestV3 | null>;
    getReference: (item: Item, v3?: string) => Promise<CollectionV2 | CollectionV3 | ManifestV2 | ManifestV3 | null>;
}

export const isCollection = (item: Item | null): boolean =>
    item !== null && (item.type === 'metadata' || item.type === 'folder');

export const isManifest = (item: Item | null): boolean =>
    item !== null && (item.type !== 'metadata' && item.type !== 'folder' && !item.order);

export async function getCollection(item: Item, access: Access, v3?: string): Promise<CollectionV2 | CollectionV3 | null> {
    if (item && (item.type === 'metadata') && typeof v3 === 'string')
        return await MetadataV3.getCollection(item as MetadataItem, builder);

    if (item && (item.type === 'metadata'))
        return await Metadata.getCollection(item as MetadataItem, builder);

    if (item && (item.type === 'folder') && typeof v3 === 'string')
        return await DigitalBornV3.getCollection(item as FolderItem, access, builder);

    if (item && (item.type === 'folder'))
        return await DigitalBorn.getCollection(item as FolderItem, access, builder);

    return null;
}

export async function getManifest(item: Item, access: Access, v3?: string): Promise<ManifestV2 | ManifestV3 | null> {
    if (item && (item.type === 'root'))
        return await Digitized.getManifest(item as RootItem);

    if (item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order) && typeof v3 === 'string')
        return await DigitalBornV3.getManifest(item as FileItem, access);

    if (item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order))
        return await DigitalBorn.getManifest(item as FileItem, access, builder);

    return null;
}

export async function getReference(item: Item, v3?: string): Promise<CollectionV2 | CollectionV3 | ManifestV2 | ManifestV3 | null> {
    if (item && (item.type === 'metadata') && typeof v3 === 'string')
        return await MetadataV3.getReference(item as MetadataItem);

    if (item && (item.type === 'metadata'))
        return await Metadata.getReference(item as MetadataItem, builder);

    if (item && (item.type === 'root'))
        return await Digitized.getReference(item as RootItem);

    if (item && ((item.type === 'folder') || !item.order) && typeof v3 === 'string')
        return await DigitalBornV3.getReference(item as FileItem);

    if (item && ((item.type === 'folder') || !item.order))
        return await DigitalBorn.getReference(item as FileItem, builder);

    return null;
}

const builder: PresentationBuilder = {isCollection, isManifest, getCollection, getManifest, getReference};
