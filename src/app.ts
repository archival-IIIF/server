import config from './lib/Config.ts';
import logger from './lib/Logger.ts';

if (config.dnsCacheEnabled)
    await import('./lib/DnsCache.ts');

import {isRunningWeb, workersRunning, standalonesRunning, cronsRunning} from './lib/Service.ts';
import type {ImplementationService, CronImplementationService} from './lib/Service.ts';

if (isRunningWeb)
    await import('./web.ts');

for (const type of Object.keys(workersRunning))
    await startWorker(type, workersRunning[type]);

if (config.appInstance === undefined || parseInt(config.appInstance) === 0) {
    for (const type of Object.keys(standalonesRunning))
        await startStandalone(standalonesRunning[type]);

    for (const type of Object.keys(cronsRunning))
        await startCron(cronsRunning[type]);
}

async function startWorker(type: string, service: ImplementationService) {
    const {onTask} = await import('./lib/Worker.ts');
    onTask(type, await service.loadService());
    logger.info(`Worker initialized for '${service.name}'`);
}

async function startStandalone(service: ImplementationService) {
    const serviceFunc = await service.loadService();
    serviceFunc();
    logger.info(`Standalone initialized for '${service.name}'`);
}

async function startCron(service: CronImplementationService) {
    const cron = await import('node-cron');
    cron.schedule(service.cron, await service.loadService());
    logger.info(`Cron ${service.cron} scheduled for ${service.name}`);
}
