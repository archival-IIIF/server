const path = require('path');

const getPronomInfo = require('../../lib/Pronom');
const {getChildItems} = require('../../lib/Item');
const {AccessState, hasAccess} = require('../../lib/Security');

const Collection = require('../elem/v2/Collection');
const Manifest = require('../elem/v2/Manifest');
const Sequence = require('../elem/v2/Sequence');
const MediaSequence = require('../elem/v2/MediaSequence');
const Canvas = require('../elem/v2/Canvas');
const Annotation = require('../elem/v2/Annotation');
const Resource = require('../elem/v2/Resource');
const Rendering = require('../elem/v2/Rendering');

const PresentationBuilder = require('./PresentationBuilder');

const {
    prefixPresentationUrl, prefixFileUrl, addLogo, addLicense, addAttribution,
    addThumbnail, addFileTypeThumbnail, setAuthenticationServices, getImageResource
} = require('./Util');

async function getCollection(item, access) {
    const label = (access !== AccessState.CLOSED) ? item.label : 'Access denied';
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, label);

    collection.setContext();
    addLogo(collection);
    addLicense(collection);
    addAttribution(collection);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    if (access !== AccessState.CLOSED) {
        addMetadata(collection, item);

        const children = await getChildItems(item.id);
        await Promise.all(children.map(async childItem => {
            const child = await PresentationBuilder.getReference(childItem);
            if (PresentationBuilder.isCollection(child))
                collection.addCollection(child);
            else if (PresentationBuilder.isManifest(child))
                collection.addManifest(child);
        }));
    }
    else {
        await setAuthenticationServices(item, collection);
    }

    return collection;
}

async function getManifest(item, access) {
    const label = (access !== AccessState.CLOSED) ? item.label : 'Access denied';
    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, label);

    manifest.setContext();
    addLogo(manifest);
    addLicense(manifest);
    addAttribution(manifest);

    if (item.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    if (access !== AccessState.CLOSED) {
        addMetadata(manifest, item);

        if (item.type !== 'image') {
            const extension = item.label ? path.extname(item.label).substring(1).toLowerCase() : null;
            addFileTypeThumbnail(manifest, item.original.puid, extension, 'file');
        }

        switch (item.type) {
            case 'image':
                await addImage(manifest, item);
                await addThumbnail(manifest, item);
                break;
            case 'audio':
                await addAudio(manifest, item);
                break;
            case 'video':
                await addVideo(manifest, item);
                break;
            case 'pdf':
                await addPdf(manifest, item);
                break;
            default:
                await addOther(manifest, item);
        }
    }
    else {
        await setAuthenticationServices(item, manifest);
    }

    return manifest;
}

async function getReference(item) {
    if (item.type === 'folder') {
        const childCollection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
        addFileTypeThumbnail(childCollection, null, null, 'folder');
        return childCollection
    }

    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, item.label);

    if (item.type === 'image')
        await addThumbnail(manifest, item);
    else {
        const extension = item.label ? path.extname(child.label).substring(1).toLowerCase() : null;
        addFileTypeThumbnail(manifest, item.original.puid, extension, 'file');
    }

    return manifest;
}

async function addImage(manifest, item) {
    const resource = await getImageResource(item);
    const annotation = new Annotation(`${prefixPresentationUrl}/${item.id}/annotation/0`, resource);
    const canvas = new Canvas(`${prefixPresentationUrl}/${item.id}/canvas/0`, annotation);
    const sequence = new Sequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, canvas);

    annotation.setCanvas(canvas);
    manifest.setItems(sequence);
}

async function addAudio(manifest, item) {
    await addMediaSequence(manifest, item, 'dctypes:Sound');
}

async function addVideo(manifest, item) {
    await addMediaSequence(manifest, item, 'dctypes:MovingImage');
}

async function addPdf(manifest, item) {
    await addMediaSequence(manifest, item, 'foaf:Document');
}

async function addOther(manifest, item) {
    await addMediaSequence(manifest, item, 'foaf:Document');
}

async function addMediaSequence(manifest, item, type) {
    const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
    const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;
    const defaultMime = accessPronomData ? accessPronomData.mime : originalPronomData.mime;

    const resource = new Resource(`${prefixFileUrl}/${item.id}`, null, null, defaultMime, type);
    const mediaSequence = new MediaSequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, resource);

    if (item.access.uri && accessPronomData)
        resource.addRendering(new Rendering(`${prefixFileUrl}/${item.id}/access`, 'Access copy', accessPronomData.mime));

    if (item.original.uri && originalPronomData)
        resource.addRendering(new Rendering(`${prefixFileUrl}/${item.id}/original`, 'Original copy', originalPronomData.mime));

    await setAuthenticationServices(item, resource);
    manifest.setMediaSequence(mediaSequence);
}

function addMetadata(base, root) {
    if (root.original.puid) {
        const pronomData = getPronomInfo(root.original.puid);
        base.addMetadata(
            'Original file type',
            `<a href="${pronomData.url}">${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
        );
    }

    if (root.access.puid && (root.type !== 'image')) {
        const pronomData = getPronomInfo(root.access.puid);
        base.addMetadata(
            'Access file type',
            `<a href="${pronomData.url}">${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
        );
    }

    if (root.size && root.created_at) {
        const steps = Math.floor(Math.log(root.size) / Math.log(1024));
        const fileSize = `${(root.size / Math.pow(1024, steps)).toFixed(2)} ${['bytes', 'KB', 'MB', 'GB', 'TB'][steps]}`;
        base.addMetadata('Original file size', root.size > 0 ? fileSize : '0 bytes');

        const date = moment(root.created_at).format('MMMM Do YYYY');
        base.addMetadata('Original modification date', date);
    }

    if (root.authors.length > 0)
        root.authors.forEach(auth => base.addMetadata(auth.type, auth.name));

    if (root.language)
        base.addMetadata('Language', root.language);

    if (root.metadata)
        base.addMetadata(root.metadata);
}

module.exports = {getCollection, getManifest, getReference};
