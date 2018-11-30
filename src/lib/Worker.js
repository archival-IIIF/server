const {client, createNewClient} = require('./Redis');
const logger = require('./Logger');
const {promisify} = require('util');

const saddAsync = promisify(client.sadd).bind(client);

function onTask(type, process, blockingClient = createNewClient()) {
    logger.debug(`Waiting for a new task with type '${type}'`);

    let identifier;
    blockingClient.blpop('tasks:' + type, 0, async (err, msg) => {
        onTask(type, process, blockingClient);

        if (err) {
            logger.error(`Failure loading a new task with type '${type}'`, err);
            return;
        }

        try {
            const task = JSON.parse(msg[1]);
            identifier = task.identifier;
            logger.debug(`Received a new task with type '${type}' and identifier '${identifier}'`);

            const noAdded = await saddAsync('tasks:' + type + ':progress', identifier);
            if (noAdded !== 1) {
                logger.debug(`Task with type '${type}' and identifier '${identifier}' is already added to the progress list`);
                return;
            }

            logger.debug(`Start progress on task with type '${type}' and identifier '${identifier}'`);
            const data = task.data;
            const result = await process(data);
            logger.debug(`Finished progress on task with type '${type}' and identifier '${identifier}'`);

            client.multi()
                .srem('tasks:' + type + ':progress', identifier)
                .publish('tasks:' + type, JSON.stringify({identifier: identifier, data: result}))
                .exec();
        }
        catch (err) {
            client.srem('tasks:' + type + ':progress', identifier);
            logger.error(`Failure during task with type '${type}' and identifier '${identifier}'`, err);
        }
    });
}

module.exports = onTask;