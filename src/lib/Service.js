const config = require('./Config');

const allServices = [{
    name: 'web',
    type: 'web',
    runAs: 'web',
    getService: () => null
}, {
    name: 'archivematica-import',
    type: 'import',
    runAs: 'worker',
    getService: () => require('../service/archivematica_import')
}, {
    name: 'iish-access',
    type: 'access',
    runAs: 'lib',
    getService: () => require('../service/iish_access')
}];

const servicesRunning = config.services.map(name => {
    const serviceFound = allServices.find(service => service.name.toLowerCase() === name.toLowerCase());
    if (!serviceFound)
        throw new Error(`No service found with the name ${name}!`);
    return serviceFound;
});

module.exports = {allServices, servicesRunning};
