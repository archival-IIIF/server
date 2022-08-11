import {existsSync} from 'fs';
import {dirname, basename, resolve} from 'path';

import {move} from 'fs-extra';
import moment from 'moment';
import chokidar from 'chokidar';

import config from '../lib/Config.js';
import logger from '../lib/Logger.js';
import {runTask} from '../lib/Task.js';
import {IndexParams} from '../lib/Service.js';

const collectionsWatching: { [path: string]: Date | null } = {};

export default function watchDirectoryForChanges(): void {
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
        const maxAgeLastChange = moment().subtract(10, 'minutes');

        for (const path of Object.keys(collectionsWatching)) {
            if (collectionsWatching[path]) {
                const lastChange = moment(collectionsWatching[path] as Date);
                if (lastChange.isBefore(maxAgeLastChange))
                    startIndexForNewCollection(path);
            }
        }
    }, 30000);
}

async function startIndexForNewCollection(path: string): Promise<void> {
    collectionsWatching[path] = null;

    const relativePath = path.replace(config.hotFolderPath as string, '.');
    const newPath = resolve(config.dataRootPath, config.collectionsRelativePath, relativePath);
    logger.info(`Move collection from hot folder ${path} to ${newPath}`);

    await move(path, newPath);
    logger.info(`Moved collection from hot folder ${path} to ${newPath}; sending index task to queue`);
    runTask<IndexParams>('index', {collectionPath: newPath});

    delete collectionsWatching[path];
}
