import {Manifest, Collection, AnnotationPage} from '@archival-iiif/presentation-builder/v3';
import {TermList, Image, ImageProfile, AnnotationList} from '@archival-iiif/presentation-builder/v2';

import {Text} from '../lib/Text.js';
import {Access} from '../lib/Security.js';
import {DerivativeType} from '../lib/Derivative.js';
import {FileItem, FolderItem, Item, MetadataItem, RootItem} from '../lib/ItemInterfaces.js';

import {SearchResult} from '../search/search.js';

import * as Search from './Search.js';
import * as Metadata from './Metadata.js';
import * as Digitized from './Digitized.js';
import * as DigitalBorn from './DigitalBorn.js';
import * as ImageFunctions from './Image.js';

export interface PresentationBuilder {
    isCollection: (item: Item | null) => boolean;
    isManifest: (item: Item | null) => boolean;
    getCollection: (item: Item, access: Access) => Promise<Collection | null>;
    getManifest: (item: Item, access: Access) => Promise<Manifest | null>;
    getReference: (item: Item) => Promise<Collection | Manifest | null>;
    getSearch: (searchResults: SearchResult[], query: string, ignored: string[], items: Item[],
                id: string, type?: string, language?: string) => AnnotationList;
    getAutocomplete: (suggestions: Set<string>, query: string, ignored: string[],
                      id: string, type?: string, language?: string) => TermList;
    getImageInfo: (item: Item, derivative: DerivativeType | null,
                   profile: ImageProfile, access: Access) => Promise<Image>;
    getStaticImageInfo: (type: 'logo' | 'audio', profile?: ImageProfile) => Promise<Image>;
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

export async function getAnnotationPage(item: Item, text: Text): Promise<AnnotationPage> {
    return Digitized.getAnnotationPage(item as RootItem, text);
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

export function getSearch(searchResults: SearchResult[], query: string, ignored: string[],
                          items: Item[], id: string, type?: string, language?: string | null): AnnotationList {
    return Search.getAnnotationList(searchResults, query, ignored, items, id, type, language);
}

export function getAutocomplete(suggestions: Set<string>, query: string, ignored: string[],
                                id: string, type?: string, language?: string | null): TermList {
    return Search.getAutocomplete(suggestions, query, ignored, id, type, language);
}

export async function getImageInfo(item: Item, derivative: DerivativeType | null,
                                   profile: ImageProfile, access: Access) {
    return ImageFunctions.getInfo(item, derivative, profile, access.tier);
}

export async function getStaticImageInfo(type: 'logo' | 'audio', profile?: ImageProfile) {
    return ImageFunctions.getStaticImageInfo(type, profile);
}

const builder: PresentationBuilder = {
    isCollection,
    isManifest,
    getCollection,
    getManifest,
    getReference,
    getSearch,
    getAutocomplete,
    getImageInfo,
    getStaticImageInfo,
};
