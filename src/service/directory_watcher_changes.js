const {existsSync} = require('fs');
const {dirname, basename, resolve} = require('path');

const moment = require('moment');
const chokidar = require('chokidar');
const {move} = require('fs-extra');

const config = require('../lib/Config');
const logger = require('../lib/Logger');
const {runTask} = require('../lib/Task');

const collectionsWatching = {};

function watchDirectoryForChanges() {
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
                const lastChange = moment(collectionsWatching[path]);
                if (lastChange.isBefore(maxAgeLastChange))
                    startIndexForNewCollection(path);
            }
        });
    }, 30000);
}

async function startIndexForNewCollection(path) {
    collectionsWatching[path] = null;

    const relativePath = path.replace(config.hotFolderPath, '.');
    const newPath = resolve(config.dataPath, relativePath);
    logger.info(`Move collection from hot folder ${path} to ${newPath}`);

    await move(path, newPath);
    logger.info(`Moved collection from hot folder ${path} to ${newPath}; sending index task to queue`);
    runTask('index', {collectionPath: newPath});

    delete collectionsWatching[path];
}

module.exports = watchDirectoryForChanges;
