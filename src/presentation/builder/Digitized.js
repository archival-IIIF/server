const getPronomInfo = require('../../lib/Pronom');
const {getChildItems} = require('../../lib/Item');
const {getProfile} = require('../../image/imageServer');

const Manifest = require('../elem/v3/Manifest');
const Canvas = require('../elem/v3/Canvas');
const AnnotationPage = require('../elem/v3/AnnotationPage');
const Annotation = require('../elem/v3/Annotation');
const Resource = require('../elem/v3/Resource');
const Service = require('../elem/v3/Service');

const {prefixImageUrl, prefixPresentationUrl, prefixFileUrl, addLicense, addAttribution} = require('./Util');

async function getManifest(item) {
    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, item.label);

    manifest.setContext();
    addLogo(manifest);
    addLicense(manifest);
    addAttribution(manifest);
    addMetadata(manifest, item);

    if (item.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    await addContent(manifest, item);

    return manifest;
}

async function getReference(item) {
    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, item.label);

    const items = await getItems(item);
    const firstItem = items[0];
    addThumbnail(manifest, firstItem);

    return manifest;
}

async function getItems(parentItem) {
    const items = await getChildItems(parentItem.id);
    items.sort((childA, childB) => (childA.order < childB.order) ? -1 : 1);
    return items;
}

async function addContent(manifest, parentItem) {
    const items = await getItems(parentItem);
    const firstItem = items[0];
    addThumbnail(manifest, firstItem);

    const manifestItems = await Promise.all(items.map(async item => {
        const page = item.order || 0;

        const resource = (item.type === 'image') ? getImageResource(item) : getResource(item);
        const canvas = new Canvas(`${prefixPresentationUrl}/${parentItem.id}/canvas/${page}`,
            item.width, item.height, item.duration);
        const annoPage = new AnnotationPage(`${prefixPresentationUrl}/${parentItem.id}/annopage/${page}/0`);
        const annotation = new Annotation(`${prefixPresentationUrl}/${parentItem.id}/annotation/${item.id}`, resource);

        canvas.setItems(annoPage);
        annoPage.setItems(annotation);

        canvas.setLabel({'en': [`Page ${page}`]});
        addThumbnail(canvas, item);

        return canvas;
    }));

    manifest.setItems(manifestItems);
}

function addMetadata(base, root) {
    if (root.authors.length > 0)
        root.authors.forEach(auth => base.addMetadata(auth.type, auth.name));

    if (root.language)
        base.addMetadata('Language', root.language);

    if (root.metadata)
        base.addMetadata(root.metadata);
}

function addLogo(base) {
    base.setLogo(new Resource(`${prefixFileUrl}/logo`, 'Image'));
}

function getResource(item) {
    const id = `${prefixFileUrl}/${item.id}`;

    const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
    const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;
    const defaultMime = accessPronomData ? accessPronomData.mime : originalPronomData.mime;

    return new Resource(id, getType(item), defaultMime, item.width, item.height, item.duration);
}

function getImageResource(item, size = 'full') {
    const id = (size === 'full')
        ? `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`
        : `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`;

    const resource = new Resource(id, 'Image', 'image/jpeg',
        (size === 'full') ? item.width : null, (size === 'full') ? item.height : null, null);
    const service = new Service(`${prefixImageUrl}/${item.id}`, Service.IMAGE_SERVICE_2,
        Array.isArray(getProfile()) ? getProfile()[0] : getProfile());
    resource.setService(service);

    return resource;
}

function addThumbnail(base, item) {
    const resource = getImageResource(item, '!100,100');
    base.setThumbnail(resource);
}

function getType(item) {
    switch (item.type) {
        case 'image':
            return 'Image';
        case 'audio':
            return 'Sound';
        case 'video':
            return 'Video';
        case 'pdf':
            return 'Text';
        default:
            return 'Dataset';
    }
}

module.exports = {getManifest, getReference};
