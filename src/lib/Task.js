const logger = require('./Logger');
const {client, createNewClient} = require('./Redis');

const getChannel = type => `tasks:${type}`;

function runTask(type, identifier, task) {
    logger.info(`Sending a new task with type '${type}' and identifier '${identifier}'`);
    client.rpush(getChannel(type), JSON.stringify({identifier: identifier, data: task}));
}

function runTaskWithResponse(type, identifier, task) {
    const timeout = 5000;
    const subscriber = createNewClient();

    return new Promise((resolve, reject) => {
        subscriber.subscribe(channel);
        subscriber.on('message', (ch, message) => {
            const msg = JSON.parse(message);
            if ((ch === getChannel(type)) && (msg.identifier === identifier)) {
                clearTimeout(timer);

                subscriber.unsubscribe();
                subscriber.end(true);

                logger.info(`Task with type '${type}' and identifier '${identifier}' has finished`);
                resolve(msg.data);
            }
        });

        const timer = setTimeout(() => {
            subscriber.unsubscribe();
            subscriber.end(true);

            reject(new Error(`Task of type ${type} with identifier ${identifier} timed out`));
        }, timeout);

        runTask(type, identifier, task);
    });
}

module.exports = {runTask, runTaskWithResponse};
