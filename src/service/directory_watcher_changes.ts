import {existsSync} from 'node:fs';
import {rename} from 'node:fs/promises';
import {dirname, basename, resolve} from 'node:path';
import dayjs from 'dayjs';
import {watch} from 'chokidar';

import config from '../lib/Config.ts';
import logger from '../lib/Logger.ts';
import {runTask} from '../lib/Task.ts';

import type {CollectionPathParams} from '../lib/ServiceTypes.ts';

const collectionsWatching: { [path: string]: Date | null } = {};

export default async function watchDirectoryForChanges(): Promise<void> {
    if (!config.hotFolderPath || !existsSync(config.hotFolderPath))
        throw new Error('No hot folder or incorrect hot folder to watch!');

    if (!config.hotFolderPattern)
        throw new Error('No hot folder root pattern configured!');
    const hotFolderPattern = new RegExp(config.hotFolderPattern);

    logger.info(`Watching hot folder ${config.hotFolderPath} for new collections`);

    watch(config.hotFolderPath).on('add', path => {
        const file = basename(path);

        if (hotFolderPattern.exec(file)) {
            const directory = dirname(path);
            if (!(directory in collectionsWatching)) {
                collectionsWatching[directory] = new Date();
                logger.info(`Found a new collection in the hot folder ${directory}`);
            }
        }
        else {
            while (path !== config.hotFolderPath) {
                if (path in collectionsWatching && collectionsWatching[path]) {
                    collectionsWatching[path] = new Date();
                    break;
                }
                path = dirname(path);
            }
        }
    });

    setInterval(() => {
        const maxAgeLastChange = dayjs().subtract(10, 'minute');

        for (const path of Object.keys(collectionsWatching)) {
            if (collectionsWatching[path]) {
                const lastChange = dayjs(collectionsWatching[path] as Date);
                if (lastChange.isBefore(maxAgeLastChange))
                    startIndexForNewCollection(path);
            }
        }
    }, 30000);
}

async function startIndexForNewCollection(path: string): Promise<void> {
    collectionsWatching[path] = null;

    const relativePath = path.replace(config.hotFolderPath!, '.');
    const newPath = resolve(config.dataRootPath, config.collectionsRelativePath, relativePath);
    logger.info(`Move collection from hot folder ${path} to ${newPath}`);

    await rename(path, newPath);
    logger.info(`Moved collection from hot folder ${path} to ${newPath}; sending index task to queue`);
    runTask<CollectionPathParams>('index', {collectionPath: newPath});

    delete collectionsWatching[path];
}
