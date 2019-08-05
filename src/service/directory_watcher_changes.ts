import {existsSync} from 'fs';
import {dirname, basename, resolve} from 'path';

import {move} from 'fs-extra';
import * as moment from 'moment';
import * as chokidar from 'chokidar';

import config from '../lib/Config';
import logger from '../lib/Logger';
import {runTask} from '../lib/Task';
import {IndexParams} from '../lib/Service';

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
            if (!collectionsWatching.hasOwnProperty(directory)) {
                collectionsWatching[directory] = new Date();
                logger.info(`Found a new collection in the hot folder ${directory}`);
            }
        }
        else {
            while (path !== config.hotFolderPath) {
                if (collectionsWatching.hasOwnProperty(path) && collectionsWatching[path]) {
                    collectionsWatching[path] = new Date();
                    break;
                }
                path = dirname(path);
            }
        }
    });

    setInterval(() => {
        const maxAgeLastChange = moment().subtract(10, 'minutes');

        Object.keys(collectionsWatching).forEach(path => {
            if (collectionsWatching[path]) {
                const lastChange = moment(collectionsWatching[path] as Date);
                if (lastChange.isBefore(maxAgeLastChange))
                    startIndexForNewCollection(path);
            }
        });
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
