const Metadata = require('./Metadata');
const Digitized = require('./Digitized');
const DigitalBorn = require('./DigitalBorn');

const isCollection = item => item && (item.type === 'metadata' || item.type === 'folder');
const isManifest = item => item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order);

async function getCollection(item, access) {
    if (item && (item.type === 'metadata'))
        return await Metadata.getCollection(item);

    if (item && (item.type === 'folder'))
        return await DigitalBorn.getCollection(item, access);

    return null;
}

async function getManifest(item, access) {
    if (item && (item.type === 'root'))
        return await Digitized.getManifest(item);

    if (item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order))
        return await DigitalBorn.getManifest(item, access);

    return null;
}

async function getReference(item) {
    if (item && (item.type === 'metadata'))
        return await Metadata.getCollection(item);

    if (item && (item.type === 'folder'))
        return await DigitalBorn.getCollection(item);

    if (item && (item.type === 'root'))
        return await Digitized.getManifest(item);

    if (item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order))
        return await DigitalBorn.getManifest(item);

    return null;
}

module.exports = {isCollection, isManifest, getCollection, getManifest, getReference};
