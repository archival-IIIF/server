const config = require('./Config');

const allServices = [{
    name: 'web',
    type: 'web',
    runAs: 'web',
    getService: () => null
}, {
    name: 'archivematica-index',
    type: 'index',
    runAs: 'worker',
    getService: () => require('../service/archivematica_index')
}, {
    name: 'iish-metadata',
    type: 'metadata',
    runAs: 'worker',
    getService: () => require('../service/iish_metadata')
}, {
    name: 'iish-metadata-update',
    type: 'metadata-update',
    runAs: 'cron',
    cron: '58 11 * * *',
    getService: () => require('../service/iish_metadata_update')
}, {
    name: 'iish-access',
    type: 'access',
    runAs: 'lib',
    getService: () => require('../service/iish_access')
}, {
    name: 'iish-auth-texts',
    type: 'auth-texts',
    runAs: 'lib',
    getService: () => require('../service/iish_auth_texts')
}];

let servicesRunning = config.services.map(name => {
    const serviceFound = allServices.find(service => service.name.toLowerCase() === name.toLowerCase());
    if (!serviceFound)
        throw new Error(`No service found with the name ${name}!`);
    return {...serviceFound};
});

if (servicesRunning.find(service => service.runAs === 'web'))
    servicesRunning = servicesRunning.map(
        service => service.runAs === 'worker' ? {...service, runAs: 'lib'} : {...service});

module.exports = {allServices, servicesRunning};
