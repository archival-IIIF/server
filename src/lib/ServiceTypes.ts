import {Item} from './ItemInterfaces.js';
import {AuthTexts} from '@archival-iiif/presentation-builder/v2';

export type EmptyParams = {};
export type IndexParams = { collectionPath: string };
export type TextParams = { collectionId: string, items: TextItem[] };
export type MetadataParams = { oaiIdentifier?: string | null, rootId?: string, collectionId?: string };
export type ReindexParams = { collectionIds?: string[], query?: string };
export type DerivativeParams = { collectionId: string };
export type AccessParams = { item: Item, ip?: string, identities?: string[] };
export type AuthTextsParams = { item: Item };
export type IIIFMetadataParams = { item: Item };
export type ProcessUpdateParams = { type: string, query: string };

export type TextItem = {
    id: string,
    itemId: string,
    type: 'transcription' | 'translation',
    language: string | null,
    encoding: string | null,
    uri: string
};

export interface IIIFMetadata {
    homepage: IIIFMetadataHomepage;
    metadata: IIIFMetadataPairs;
    seeAlso: IIIFMetadataSeeAlso;
}

export type IIIFMetadataHomepage = { id: string; label: string; }[];
export type IIIFMetadataPairs = { label: string; value: string; }[];
export type IIIFMetadataSeeAlso = { id: string; format: string; profile: string; label: string; }[];

export type AuthTextsByType = { [type: string]: AuthTexts; };
