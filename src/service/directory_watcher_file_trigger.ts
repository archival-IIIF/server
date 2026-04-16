import {existsSync} from 'node:fs';
import {rename} from 'node:fs/promises';
import {dirname, basename, resolve} from 'node:path';
import {watch} from 'chokidar';

import config from '../lib/Config.ts';
import logger from '../lib/Logger.ts';
import {runTask} from '../lib/Task.ts';

import type {CollectionPathParams} from '../lib/ServiceTypes.ts';

export default async function watchDirectoryForFileTrigger(): Promise<void> {
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
            logger.info(`Found a new collection in the hot folder ${directory}`);
            startIndexForNewCollection(directory);
        }
    });
}

async function startIndexForNewCollection(path: string): Promise<void> {
    const relativePath = path.replace(config.hotFolderPath!, '.');
    const newPath = resolve(config.dataRootPath, config.collectionsRelativePath, relativePath);
    logger.info(`Move collection from hot folder ${path} to ${newPath}`);

    await rename(path, newPath);
    logger.info(`Moved collection from hot folder ${path} to ${newPath}; sending index task to queue`);
    runTask<CollectionPathParams>('index', {collectionPath: newPath});
}
