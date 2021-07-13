import config from './Config';
import {Item} from './ItemInterfaces';
import {TextItem} from '../service/util/types';

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
    getService: () => <P, R>(params: P) => Promise<R>;
}

export interface StandaloneService extends Service {
    runAs: 'standalone' | 'cron';
    getService: () => <R>() => Promise<R>;
}

export interface CronService extends StandaloneService {
    runAs: 'cron';
    cron: string;
}

export type IndexParams = { collectionPath: string };
export type TextParams = { collectionId: string, items: TextItem[] };
export type MetadataParams = { oaiIdentifier?: string | null, rootId?: string, collectionId?: string };
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
    getService: () => require('../service/directory_watcher_changes').default
}, {
    name: 'directory-watcher-file-trigger',
    type: 'watcher',
    runAs: 'standalone',
    getService: () => require('../service/directory_watcher_file_trigger').default
}, {
    name: 'iish-archivematica-index',
    type: 'index',
    runAs: 'worker',
    getService: () => require('../service/iish/archivematica_index').default
}, {
    name: 'text-index',
    type: 'text',
    runAs: 'worker',
    getService: () => require('../service/text_index').default
}, {
    name: 'iish-metadata',
    type: 'metadata',
    runAs: 'worker',
    getService: () => require('../service/iish/metadata').default
}, {
    name: 'niod-metadata',
    type: 'metadata',
    runAs: 'worker',
    getService: () => require('../service/niod/metadata').default
}, {
    name: 'process-update',
    type: 'process-update',
    runAs: 'worker',
    getService: () => require('../service/process_update').default
}, {
    name: 'waveform',
    type: 'waveform',
    runAs: 'worker',
    getService: () => require('../service/waveform').default
}, {
    name: 'pdf-image',
    type: 'pdf-image',
    runAs: 'worker',
    getService: () => require('../service/pdf_image').default
}, {
    name: 'video-image',
    type: 'video-image',
    runAs: 'worker',
    getService: () => require('../service/video_image').default
}, {
    name: 'iish-metadata-update',
    type: 'metadata-update',
    runAs: 'cron',
    cron: '58 11 * * *',
    getService: () => require('../service/iish/metadata_update').default
}, {
    name: 'default-access',
    type: 'access',
    runAs: 'lib',
    getService: () => require('../service/access').default
}, {
    name: 'iish-access',
    type: 'access',
    runAs: 'lib',
    getService: () => require('../service/iish/access').default
}, {
    name: 'niod-access',
    type: 'access',
    runAs: 'lib',
    getService: () => require('../service/niod/access').default
}, {
    name: 'default-auth-texts',
    type: 'auth-texts',
    runAs: 'lib',
    getService: () => require('../service/auth_texts').default
}, {
    name: 'iish-auth-texts',
    type: 'auth-texts',
    runAs: 'lib',
    getService: () => require('../service/iish/auth_texts').default
}, {
    name: 'default-iiif-metadata',
    type: 'iiif-metadata',
    runAs: 'lib',
    getService: () => require('../service/iiif_metadata').default
}, {
    name: 'iish-iiif-metadata',
    type: 'iiif-metadata',
    runAs: 'lib',
    getService: () => require('../service/iish/iiif_metadata').default
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
