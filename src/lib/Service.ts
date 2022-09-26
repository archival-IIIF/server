import config from './Config.js';

interface Service {
    type: string;
    runAs: 'worker' | 'lib' | 'standalone' | 'cron';
    implementations: ImplementationService[];
}

export interface ImplementationService {
    name: string;
    loadService: () => Promise<any>;
}

export interface CronImplementationService extends ImplementationService {
    cron: string;
}

export interface ImplementationService {
    name: string;
    loadService: () => Promise<any>;
}

export const allServices: Service[] = [{
    type: 'index',
    runAs: 'worker',
    implementations: [{
        name: 'iish-archivematica-index',
        loadService: async () => (await import('../service/iish/archivematica_index.js')).default
    }]
}, {
    type: 'text',
    runAs: 'worker',
    implementations: [{
        name: 'text-index',
        loadService: async () => (await import('../service/text_index.js')).default
    }]
}, {
    type: 'metadata',
    runAs: 'worker',
    implementations: [{
        name: 'iish-metadata',
        loadService: async () => (await import('../service/iish/metadata.js')).default
    }, {
        name: 'niod-metadata',
        loadService: async () => (await import('../service/niod/metadata.js')).default
    }]
}, {
    type: 'reindex',
    runAs: 'worker',
    implementations: [{
        name: 'iish-archivematica-reindex',
        loadService: async () => (await import('../service/iish/archivematica_reindex.js')).default
    }]
}, {
    type: 'process-update',
    runAs: 'worker',
    implementations: [{
        name: 'process-update',
        loadService: async () => (await import('../service/process_update.js')).default
    }]
}, {
    type: 'all-metadata-update',
    runAs: 'worker',
    implementations: [{
        name: 'all-metadata-update',
        loadService: async () => (await import('../service/all_metadata_update.js')).default
    }]
}, {
    type: 'waveform',
    runAs: 'worker',
    implementations: [{
        name: 'waveform',
        loadService: async () => (await import('../service/waveform.js')).default
    }]
}, {
    type: 'pdf-image',
    runAs: 'worker',
    implementations: [{
        name: 'pdf-image',
        loadService: async () => (await import('../service/pdf_image.js')).default
    }]
}, {
    type: 'video-image',
    runAs: 'worker',
    implementations: [{
        name: 'video-image',
        loadService: async () => (await import('../service/video_image.js')).default
    }]
}, {
    type: 'access',
    runAs: 'lib',
    implementations: [{
        name: 'default-access',
        loadService: async () => (await import('../service/access.js')).default
    }, {
        name: 'iish-access',
        loadService: async () => (await import('../service/iish/access.js')).default
    }, {
        name: 'niod-access',
        loadService: async () => (await import('../service/niod/access.js')).default
    }]
}, {
    type: 'auth-texts',
    runAs: 'lib',
    implementations: [{
        name: 'default-auth-texts',
        loadService: async () => (await import('../service/auth_texts.js')).default
    }, {
        name: 'iish-auth-texts',
        loadService: async () => (await import('../service/iish/auth_texts.js')).default
    }]
}, {
    type: 'iiif-metadata',
    runAs: 'lib',
    implementations: [{
        name: 'default-iiif-metadata',
        loadService: async () => (await import('../service/iiif_metadata.js')).default
    }, {
        name: 'iish-iiif-metadata',
        loadService: async () => (await import('../service/iish/iiif_metadata.js')).default
    }]
}, {
    type: 'watcher',
    runAs: 'standalone',
    implementations: [{
        name: 'directory-watcher-changes',
        loadService: async () => (await import('../service/directory_watcher_changes.js')).default
    }, {
        name: 'directory-watcher-file-trigger',
        loadService: async () => (await import('../service/directory_watcher_file_trigger.js')).default
    }]
}, {
    type: 'metadata-update',
    runAs: 'cron',
    implementations: [{
        name: 'iish-metadata-update',
        cron: '58 11 * * *',
        loadService: async () => (await import('../service/iish/metadata_update.js')).default
    } as CronImplementationService]
}];

export let isRunningWeb: boolean = config.services.find(name => name.toLowerCase() === 'web') != undefined;
export let workersRunning: { [type: string]: ImplementationService } = {};
export let libsRunning: { [type: string]: ImplementationService } = {};
export let standalonesRunning: { [type: string]: ImplementationService } = {};
export let cronsRunning: { [type: string]: CronImplementationService } = {};

for (const name of config.services.filter(name => name.toLowerCase() != 'web')) {
    const serviceFound = allServices.find(service =>
        service.implementations.find(impl =>
            impl.name.toLowerCase() === name.toLowerCase()));
    if (!serviceFound)
        throw new Error(`No service found with the name ${name}!`);

    const implementation = serviceFound.implementations
        .find(impl => impl.name.toLowerCase() === name.toLowerCase());
    if (!implementation)
        throw new Error(`No implementation found with the name ${name}!`);

    switch (serviceFound.runAs) {
        case 'worker':
            if (serviceFound.type in workersRunning)
                throw new Error(`There is more than one worker of type '${serviceFound.type}' configured!`);
            workersRunning[serviceFound.type] = {name: implementation.name, loadService: implementation.loadService};
            break;
        case 'lib':
            if (serviceFound.type in libsRunning)
                throw new Error(`There is more than one lib of type '${serviceFound.type}' configured!`);
            libsRunning[serviceFound.type] = implementation;
            break;
        case 'standalone':
            if (serviceFound.type in standalonesRunning)
                throw new Error(`There is more than one standalone of type '${serviceFound.type}' configured!`);
            standalonesRunning[serviceFound.type] = implementation;
            break;
        case 'cron':
            if (serviceFound.type in cronsRunning)
                throw new Error(`There is more than one cron of type '${serviceFound.type}' configured!`);
            cronsRunning[serviceFound.type] = implementation as CronImplementationService;
            break;
    }
}

for (const libService of allServices.filter(service => service.runAs === 'lib')) {
    if (!(libService.type in libsRunning)) {
        libsRunning[libService.type] = libService.implementations[0];
    }
}

// for testing purposes
export function setLibsRunning(services: { [type: string]: ImplementationService }) {
    if (config.env === 'test')
        libsRunning = services;
}

// for testing purposes
export function setWorkersRunning(services: { [type: string]: ImplementationService }) {
    if (config.env === 'test')
        workersRunning = services;
}
