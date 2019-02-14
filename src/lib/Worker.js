const {client, createNewClient} = require('./Redis');
const logger = require('./Logger');

function onTask(type, process, blockingClient = createNewClient()) {
    logger.debug(`Waiting for a new task with type '${type}'`);

    let identifier;
    blockingClient.blpop('tasks:' + type, 0).then(async msg => {
        onTask(type, process, blockingClient);

        try {
            const task = JSON.parse(msg[1]);
            identifier = task.identifier;
            logger.debug(`Received a new task with type '${type}' and identifier '${identifier}'`);

            const noAdded = await client.sadd('tasks:' + type + ':progress', identifier);
            if (noAdded !== 1) {
                logger.debug(`Task with type '${type}' and identifier '${identifier}' is already added to the progress list`);
                return;
            }

            logger.debug(`Start progress on task with type '${type}' and identifier '${identifier}'`);
            const data = task.data;
            const result = await process(data);
            logger.debug(`Finished progress on task with type '${type}' and identifier '${identifier}'`);

            await client.execMulti(
                client.multi()
                    .srem('tasks:' + type + ':progress', identifier)
                    .publish('tasks:' + type, JSON.stringify({identifier: identifier, data: result}))
            );
        }
        catch (err) {
            client.srem('tasks:' + type + ':progress', identifier);
            logger.error(`Failure during task with type '${type}' and identifier '${identifier}'`, err);
        }
    }).catch(err => {
        logger.error(`Failure loading a new task with type '${type}'`, err);
        onTask(type, process, blockingClient);
    });
}

module.exports = onTask;