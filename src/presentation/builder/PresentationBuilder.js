const Metadata = require('./Metadata');
const Digitized = require('./Digitized');
const DigitalBorn = require('./DigitalBorn');

const isCollection = item => item && (item.type === 'metadata' || item.type === 'folder');
const isManifest = item => item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order);

const builder = {isCollection, isManifest, getCollection, getManifest, getReference};

async function getCollection(item, access) {
    if (item && (item.type === 'metadata'))
        return await Metadata.getCollection(item, builder);

    if (item && (item.type === 'folder'))
        return await DigitalBorn.getCollection(item, access, builder);

    return null;
}

async function getManifest(item, access) {
    if (item && (item.type === 'root'))
        return await Digitized.getManifest(item, builder);

    if (item && (item.type !== 'metadata' && item.type !== 'folder' && !item.order))
        return await DigitalBorn.getManifest(item, access, builder);

    return null;
}

async function getReference(item) {
    if (item && (item.type === 'metadata'))
        return await Metadata.getReference(item, builder);

    if (item && (item.type === 'root'))
        return await Digitized.getReference(item, builder);

    if (item && ((item.type === 'folder') || !item.order))
        return await DigitalBorn.getReference(item, builder);

    return null;
}

module.exports = builder;
