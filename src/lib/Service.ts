import config from './Config.js';
import {Item} from './ItemInterfaces.js';
import {TextItem} from '../service/util/types.js';

export interface Service {
    name: string;
    type: string;

    [propName: string]: any;
}

export interface WebService extends Service {
    runAs: 'web';
}

export interface ArgService extends Service {
    runAs: 'worker' | 'lib';
    getService: () => Promise<<P, R>(params: P) => Promise<R>>;
}

export interface StandaloneService extends Service {
    runAs: 'standalone' | 'cron';
    getService: () => Promise<<R>() => Promise<R>>;
}

export interface CronService extends StandaloneService {
    runAs: 'cron';
    cron: string;
}

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

export const allServices: Service[] = [{
    name: 'web',
    type: 'web',
    runAs: 'web',
}, {
    name: 'directory-watcher-changes',
    type: 'watcher',
    runAs: 'standalone',
    getService: async () => (await import('../service/directory_watcher_changes.js')).default
}, {
    name: 'directory-watcher-file-trigger',
    type: 'watcher',
    runAs: 'standalone',
    getService: async () => (await import('../service/directory_watcher_file_trigger.js')).default
}, {
    name: 'iish-archivematica-index',
    type: 'index',
    runAs: 'worker',
    getService: async () => (await import('../service/iish/archivematica_index.js')).default
}, {
    name: 'text-index',
    type: 'text',
    runAs: 'worker',
    getService: async () => (await import('../service/text_index.js')).default
}, {
    name: 'iish-metadata',
    type: 'metadata',
    runAs: 'worker',
    getService: async () => (await import('../service/iish/metadata.js')).default
}, {
    name: 'niod-metadata',
    type: 'metadata',
    runAs: 'worker',
    getService: async () => (await import('../service/niod/metadata.js')).default
}, {
    name: 'iish-archivematica-reindex',
    type: 'reindex',
    runAs: 'worker',
    getService: async () => (await import('../service/iish/archivematica_reindex.js')).default
}, {
    name: 'process-update',
    type: 'process-update',
    runAs: 'worker',
    getService: async () => (await import('../service/process_update.js')).default
}, {
    name: 'all-metadata-update',
    type: 'all-metadata-update',
    runAs: 'worker',
    getService: async () => (await import('../service/all_metadata_update.js')).default
}, {
    name: 'waveform',
    type: 'waveform',
    runAs: 'worker',
    getService: async () => (await import('../service/waveform.js')).default
}, {
    name: 'pdf-image',
    type: 'pdf-image',
    runAs: 'worker',
    getService: async () => (await import('../service/pdf_image.js')).default
}, {
    name: 'video-image',
    type: 'video-image',
    runAs: 'worker',
    getService: async () => (await import('../service/video_image.js')).default
}, {
    name: 'iish-metadata-update',
    type: 'metadata-update',
    runAs: 'cron',
    cron: '58 11 * * *',
    getService: async () => (await import('../service/iish/metadata_update.js')).default
}, {
    name: 'default-access',
    type: 'access',
    runAs: 'lib',
    getService: async () => (await import('../service/access.js')).default
}, {
    name: 'iish-access',
    type: 'access',
    runAs: 'lib',
    getService: async () => (await import('../service/iish/access.js')).default
}, {
    name: 'niod-access',
    type: 'access',
    runAs: 'lib',
    getService: async () => (await import('../service/niod/access.js')).default
}, {
    name: 'default-auth-texts',
    type: 'auth-texts',
    runAs: 'lib',
    getService: async () => (await import('../service/auth_texts.js')).default
}, {
    name: 'iish-auth-texts',
    type: 'auth-texts',
    runAs: 'lib',
    getService: async () => (await import('../service/iish/auth_texts.js')).default
}, {
    name: 'default-iiif-metadata',
    type: 'iiif-metadata',
    runAs: 'lib',
    getService: async () => (await import('../service/iiif_metadata.js')).default
}, {
    name: 'iish-iiif-metadata',
    type: 'iiif-metadata',
    runAs: 'lib',
    getService: async () => (await import('../service/iish/iiif_metadata.js')).default
}];

export let servicesRunning: Service[] = config.services.map(name => {
    const serviceFound = allServices.find(service => service.name.toLowerCase() === name.toLowerCase());
    if (!serviceFound)
        throw new Error(`No service found with the name ${name}!`);
    return {...serviceFound};
});

servicesRunning.reduce<string[]>((acc, service) => {
    if (acc.includes(service.type))
        throw new Error(`There is more than one service of type '${service.type}' configured!`);
    acc.push(service.type);
    return acc;
}, []);

if (servicesRunning.find(service => service.runAs === 'web'))
    servicesRunning = servicesRunning.map(
        service => service.runAs === 'worker' ? <Service>{...service, runAs: 'lib'} : {...service});

// for testing purposes
export function setServicesRunning(services: Service[]) {
    if (config.env === 'test')
        servicesRunning = services;
}
