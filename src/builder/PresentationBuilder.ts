import * as Metadata from './Metadata';
import * as Digitized from './Digitized';
import * as DigitalBorn from './DigitalBorn';
import * as ImageFunctions from './Image';

import {Access} from '../lib/Security';
import {DerivativeType} from '../lib/Derivative';
import {FileItem, FolderItem, Item, MetadataItem, RootItem} from '../lib/ItemInterfaces';

import Manifest from '@archival-iiif/presentation-builder/dist/v3/Manifest';
import Collection from '@archival-iiif/presentation-builder/dist/v3/Collection';
import Image, {ImageProfile} from '@archival-iiif/presentation-builder/dist/v2/Image';

export interface PresentationBuilder {
    isCollection: (item: Item | null) => boolean;
    isManifest: (item: Item | null) => boolean;
    getCollection: (item: Item, access: Access) => Promise<Collection | null>;
    getManifest: (item: Item, access: Access) => Promise<Manifest | null>;
    getReference: (item: Item) => Promise<Collection | Manifest | null>;
    getImageInfo: (item: Item, derivative: DerivativeType | null,
                   profile: ImageProfile, access: Access) => Promise<Image>;
    getLogoInfo: (profile: ImageProfile) => Promise<Image>;
    getAudioInfo: (profile: ImageProfile) => Promise<Image>;
}

export const isCollection = (item: Item | null): boolean =>
    item !== null && (item.type === 'metadata' || item.type === 'folder');

export const isManifest = (item: Item | null): boolean =>
    item !== null && (item.type !== 'metadata' && item.type !== 'folder' && (!item.order || item.type === 'root'));

export async function getCollection(item: Item, access: Access): Promise<Collection | null> {
    if (item && (item.type === 'metadata'))
        return Metadata.getCollection(item as MetadataItem, builder);

    if (item && (item.type === 'folder'))
        return DigitalBorn.getCollection(item as FolderItem, access, builder);

    return null;
}

export async function getCollectionWithChildren(item: MetadataItem, children: Item[]): Promise<Collection | null> {
    return Metadata.getCollectionWithChildren(item, children, builder);
}

export async function getManifest(item: Item, access: Access): Promise<Manifest | null> {
    if (item && (item.type === 'root'))
        return Digitized.getManifest(item as RootItem);

    if (item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order))
        return DigitalBorn.getManifest(item as FileItem, access);

    return null;
}

export async function getReference(item: Item): Promise<Collection | Manifest | null> {
    if (item && (item.type === 'metadata'))
        return Metadata.getReference(item as MetadataItem);

    if (item && (item.type === 'root'))
        return Digitized.getReference(item as RootItem);

    if (item && ((item.type === 'folder') || !item.order))
        return DigitalBorn.getReference(item as FileItem);

    return null;
}

export async function getImageInfo(item: Item, derivative: DerivativeType | null,
                                   profile: ImageProfile, access: Access) {
    return ImageFunctions.getInfo(item, derivative, profile, access.tier);
}

export async function getLogoInfo(profile: ImageProfile) {
    return ImageFunctions.getLogoInfo(profile);
}

export async function getAudioInfo(profile: ImageProfile) {
    return ImageFunctions.getAudioInfo(profile);
}

const builder: PresentationBuilder = {
    isCollection,
    isManifest,
    getCollection,
    getManifest,
    getReference,
    getImageInfo,
    getLogoInfo,
    getAudioInfo
};
