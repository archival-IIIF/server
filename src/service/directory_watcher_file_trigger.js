const {existsSync} = require('fs');
const {dirname, basename, resolve} = require('path');

const chokidar = require('chokidar');
const {move} = require('fs-extra');

const config = require('../lib/Config');
const logger = require('../lib/Logger');
const {runTask} = require('../lib/Task');

function watchDirectoryForFileTrigger() {
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

async function startIndexForNewCollection(path) {
    const relativePath = path.replace(config.hotFolderPath, '.');
    const newPath = resolve(config.dataPath, relativePath);
    logger.info(`Move collection from hot folder ${path} to ${newPath}`);

    await move(path, newPath);
    logger.info(`Moved collection from hot folder ${path} to ${newPath}; sending index task to queue`);
    runTask('index', {collectionPath: newPath});
}

module.exports = watchDirectoryForFileTrigger;
