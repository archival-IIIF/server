const {getChildItems} = require('../../lib/Item');
const Collection = require('../elem/v2/Collection');
const PresentationBuilder = require('./PresentationBuilder');

const {
    prefixPresentationUrl, addLogo, addLicense, addAttribution, addFileTypeThumbnail
} = require('./Util');

async function getCollection(item) {
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);

    collection.setContext();
    addLogo(collection);
    addLicense(collection);
    addAttribution(collection);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    addMetadata(collection, item);

    const children = await getChildItems(item.id);
    await Promise.all(children.map(async childItem => {
        const child = await PresentationBuilder.getReference(childItem);
        if (PresentationBuilder.isCollection(child))
            collection.addCollection(child);
        else if (PresentationBuilder.isManifest(child))
            collection.addManifest(child);
    }));

    return collection;
}

async function getReference(item) {
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
    addFileTypeThumbnail(collection, null, null, 'folder');
    return collection;
}

function addMetadata(base, root) {
    if (root.authors.length > 0)
        root.authors.forEach(auth => base.addMetadata(auth.type, auth.name));

    if (root.language)
        base.addMetadata('Language', root.language);

    if (root.metadata)
        base.addMetadata(root.metadata);
}

module.exports = {getCollection, getReference};
