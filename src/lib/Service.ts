import config from './Config.ts';

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
        name: 'iish-index',
        loadService: async () => (await import('../service/iish/index.ts')).default
    }, {
        name: 'niod-index',
        loadService: async () => (await import('../service/niod/index.ts')).default
    }, {
        name: 'ecodices-index',
        loadService: async () => (await import('../service/ecodices/index.ts')).default
    }]
}, {
    type: 'text',
    runAs: 'worker',
    implementations: [{
        name: 'text-index',
        loadService: async () => (await import('../service/text_index.ts')).default
    }]
}, {
    type: 'metadata',
    runAs: 'worker',
    implementations: [{
        name: 'iish-metadata',
        loadService: async () => (await import('../service/iish/metadata.ts')).default
    }, {
        name: 'ecodices-metadata',
        loadService: async () => (await import('../service/ecodices/metadata.ts')).default
    }]
}, {
    type: 'reindex',
    runAs: 'worker',
    implementations: [{
        name: 'archivematica-reindex',
        loadService: async () => (await import('../service/archivematica_reindex.ts')).default
    }]
}, {
    type: 'process-update',
    runAs: 'worker',
    implementations: [{
        name: 'process-update',
        loadService: async () => (await import('../service/process_update.ts')).default
    }]
}, {
    type: 'all-metadata-update',
    runAs: 'worker',
    implementations: [{
        name: 'all-metadata-update',
        loadService: async () => (await import('../service/all_metadata_update.ts')).default
    }]
}, {
    type: 'waveform',
    runAs: 'worker',
    implementations: [{
        name: 'waveform',
        loadService: async () => (await import('../service/waveform.ts')).default
    }]
}, {
    type: 'pdf-image',
    runAs: 'worker',
    implementations: [{
        name: 'pdf-image',
        loadService: async () => (await import('../service/pdf_image.ts')).default
    }]
}, {
    type: 'video-image',
    runAs: 'worker',
    implementations: [{
        name: 'video-image',
        loadService: async () => (await import('../service/video_image.ts')).default
    }]
}, {
    type: 'access',
    runAs: 'lib',
    implementations: [{
        name: 'default-access',
        loadService: async () => (await import('../service/access.ts')).default
    }, {
        name: 'iish-access',
        loadService: async () => (await import('../service/iish/access.ts')).default
    }, {
        name: 'niod-access',
        loadService: async () => (await import('../service/niod/access.ts')).default
    }]
}, {
    type: 'auth-texts',
    runAs: 'lib',
    implementations: [{
        name: 'default-auth-texts',
        loadService: async () => (await import('../service/auth_texts.ts')).default
    }, {
        name: 'iish-auth-texts',
        loadService: async () => (await import('../service/iish/auth_texts.ts')).default
    }]
}, {
    type: 'basic-iiif-metadata',
    runAs: 'lib',
    implementations: [{
        name: 'default-basic-iiif-metadata',
        loadService: async () => (await import('../service/basic_iiif_metadata.ts')).default
    }, {
        name: 'iish-basic-iiif-metadata',
        loadService: async () => (await import('../service/iish/basic_iiif_metadata.ts')).default
    }, {
        name: 'ecodices-basic-iiif-metadata',
        loadService: async () => (await import('../service/ecodices/basic_iiif_metadata.ts')).default
    }]
}, {
    type: 'canvas-iiif-metadata',
    runAs: 'lib',
    implementations: [{
        name: 'default-canvas-iiif-metadata',
        loadService: async () => (await import('../service/basic_iiif_metadata.ts')).default
    }, {
        name: 'ecodices-canvas-iiif-metadata',
        loadService: async () => (await import('../service/ecodices/canvas_iiif_metadata.ts')).default
    }]
}, {
    type: 'root-file-item',
    runAs: 'lib',
    implementations: [{
        name: 'default-root-file-item',
        loadService: async () => (await import('../service/root_file_item.ts')).default
    }, {
        name: 'iish-root-file-item',
        loadService: async () => (await import('../service/iish/root_file_item.ts')).default
    }, {
        name: 'ecodices-root-file-item',
        loadService: async () => (await import('../service/ecodices/root_file_item.ts')).default
    }]
}, {
    type: 'top-collections',
    runAs: 'lib',
    implementations: [{
        name: 'default-top-collections',
        loadService: async () => (await import('../service/top_collections.ts')).default
    }, {
        name: 'iish-top-collections',
        loadService: async () => (await import('../service/iish/top_collections.ts')).default
    }]
}, {
    type: 'watcher',
    runAs: 'standalone',
    implementations: [{
        name: 'directory-watcher-changes',
        loadService: async () => (await import('../service/directory_watcher_changes.ts')).default
    }, {
        name: 'directory-watcher-file-trigger',
        loadService: async () => (await import('../service/directory_watcher_file_trigger.ts')).default
    }]
}, {
    type: 'metadata-update',
    runAs: 'cron',
    implementations: [{
        name: 'iish-metadata-update',
        cron: '58 11 * * *',
        loadService: async () => (await import('../service/iish/metadata_update.ts')).default
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
