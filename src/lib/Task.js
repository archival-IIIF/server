const uuid = require('uuid/v1');
const logger = require('./Logger');
const {servicesRunning} = require('./Service');
const {client, createNewClient} = require('./Redis');

const getChannel = type => `tasks:${type}`;
const getServiceByType = type => servicesRunning.find(service => (service.type === type) && (service.runAs === 'lib'));

function runTask(type, task, identifier = uuid()) {
    const service = getServiceByType(type);
    if (service) {
        service.getService()(task);
        return;
    }

    logger.debug(`Sending a new task with type '${type}' and identifier '${identifier}'`);
    client.rpush(getChannel(type), JSON.stringify({identifier: identifier, data: task}));
}

function runTaskWithResponse(type, task, identifier = uuid()) {
    const service = getServiceByType(type);
    if (service)
        return service.getService()(task);

    const timeout = 5000;
    const subscriber = createNewClient();

    return new Promise((resolve, reject) => {
        subscriber.subscribe(getChannel(type));
        subscriber.on('message', (ch, message) => {
            const msg = JSON.parse(message);
            if ((ch === getChannel(type)) && (msg.identifier === identifier)) {
                clearTimeout(timer);

                subscriber.unsubscribe();
                subscriber.end(true);

                logger.debug(`Task with type '${type}' and identifier '${identifier}' has finished`);
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
