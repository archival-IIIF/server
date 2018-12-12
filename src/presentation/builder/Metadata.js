const config = require('../../lib/Config');
const {getChildItems} = require('../../lib/Item');
const {runTaskWithResponse} = require('../../lib/Task');

const Collection = require('../elem/v2/Collection');

const prefixFileUrl = `${config.baseUrl}/file`;
const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;

async function getCollection(item, builder) {
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);

    setDefaults(collection);

    if (item.description)
        collection.setDescription(item.description);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    await addMetadata(collection, item);

    const children = await getChildItems(item.id);
    await Promise.all(children.map(async childItem => {
        const child = await builder.getReference(childItem);
        if (builder.isCollection(childItem))
            collection.addCollection(child);
        else if (builder.isManifest(childItem))
            collection.addManifest(child);
    }));

    return collection;
}

async function getReference(item, builder) {
    return new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
}

async function addMetadata(base, root) {
    if (root.authors.length > 0) {
        const authors = root.authors.reduce((acc, author) =>
            acc[author.type] ? acc[author.type].push(author.name) : acc[author.type] = [author.name], {});
        Object.entries(authors).forEach(type => base.addMetadata(type, authors[type]));
    }

    if (root.dates.length > 0)
        base.addMetadata('Dates', root.dates);

    if (root.physical)
        base.addMetadata('Physical description', root.physical);

    if (root.metadata.length > 0)
        base.addMetadata(root.metadata);

    const md = await runTaskWithResponse('iiif-metadata', {item: root});
    if (md && md.length > 0)
        base.addMetadata(md);
}

function setDefaults(collection) {
    collection.setContext();
    collection.setLogo(`${prefixFileUrl}/logo`);
    if (config.attribution)
        collection.setAttribution(config.attribution);
}

module.exports = {getCollection, getReference};
