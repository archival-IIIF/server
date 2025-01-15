import {existsSync} from 'node:fs';
import {dirname, basename, resolve} from 'node:path';

import {move} from 'fs-extra';
import chokidar from 'chokidar';

import config from '../lib/Config.js';
import logger from '../lib/Logger.js';
import {runTask} from '../lib/Task.js';
import {CollectionPathParams} from '../lib/ServiceTypes.js';

export default async function watchDirectoryForFileTrigger(): Promise<void> {
    if (!config.hotFolderPath || !existsSync(config.hotFolderPath))
        throw new Error('No hot folder or incorrect hot folder to watch!');

    if (!config.hotFolderPattern)
        throw new Error('No hot folder root pattern configured!');
    const hotFolderPattern = new RegExp(config.hotFolderPattern);

    logger.info(`Watching hot folder ${config.hotFolderPath} for new collections`);

    chokidar.watch(config.hotFolderPath).on('add', path => {
        const file = basename(path);

        if (hotFolderPattern.exec(file)) {
            const directory = dirname(path);
            logger.info(`Found a new collection in the hot folder ${directory}`);
            startIndexForNewCollection(directory);
        }
    });
}

async function startIndexForNewCollection(path: string): Promise<void> {
    const relativePath = path.replace(config.hotFolderPath as string, '.');
    const newPath = resolve(config.dataRootPath, config.collectionsRelativePath, relativePath);
    logger.info(`Move collection from hot folder ${path} to ${newPath}`);

    await move(path, newPath);
    logger.info(`Moved collection from hot folder ${path} to ${newPath}; sending index task to queue`);
    runTask<CollectionPathParams>('index', {collectionPath: newPath});
}
