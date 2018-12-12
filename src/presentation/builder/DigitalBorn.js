const path = require('path');
const moment = require('moment');

const config = require('../../lib/Config');
const getPronomInfo = require('../../lib/Pronom');
const {getChildItems} = require('../../lib/Item');
const {runTaskWithResponse} = require('../../lib/Task');
const {iconsByExtension} = require('../../lib/FileIcon');
const {AccessState, enabledAuthServices, requiresAuthentication, getAuthTexts} = require('../../lib/Security');

const Image = require('../../image/Image');
const {getProfile} = require('../../image/imageServer');

const Collection = require('../elem/v2/Collection');
const Manifest = require('../elem/v2/Manifest');
const Sequence = require('../elem/v2/Sequence');
const MediaSequence = require('../elem/v2/MediaSequence');
const Canvas = require('../elem/v2/Canvas');
const Annotation = require('../elem/v2/Annotation');
const Resource = require('../elem/v2/Resource');
const Rendering = require('../elem/v2/Rendering');
const AuthService = require('../elem/v2/AuthService');

const defaultFileIcon = 'blank';
const defaultFolderIcon = 'folder';

const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;
const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixAuthUrl = `${config.baseUrl}/iiif/auth`;
const prefixFileUrl = `${config.baseUrl}/file`;
const prefixIconUrl = `${config.baseUrl}/file-icon`;

async function getCollection(item, access, builder) {
    const label = (access !== AccessState.CLOSED) ? item.label : 'Access denied';
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, label);

    setDefaults(collection);

    if (item.description)
        collection.setDescription(item.description);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    if (access !== AccessState.CLOSED) {
        await addMetadata(collection, item);

        const children = await getChildItems(item.id);
        await Promise.all(children.map(async childItem => {
            const child = await builder.getReference(childItem);
            if (builder.isCollection(childItem))
                collection.addCollection(child);
            else if (builder.isManifest(childItem))
                collection.addManifest(child);
        }));
    }
    else {
        await setAuthenticationServices(item, collection);
    }

    return collection;
}

async function getManifest(item, access, builder) {
    const label = (access !== AccessState.CLOSED) ? item.label : 'Access denied';
    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, label);

    setDefaults(manifest);

    if (item.description)
        collection.setDescription(item.description);

    if (item.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    if (access !== AccessState.CLOSED) {
        await addMetadata(manifest, item);

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

async function getReference(item, builder) {
    if (item.type === 'folder') {
        const childCollection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
        addFileTypeThumbnail(childCollection, null, null, 'folder');
        return childCollection;
    }

    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, item.label);

    if (item.type === 'image')
        await addThumbnail(manifest, item);
    else {
        const extension = item.label ? path.extname(item.label).substring(1).toLowerCase() : null;
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
    manifest.setSequence(sequence);
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

async function addMetadata(base, root) {
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

async function getImageResource(item, size = 'full') {
    const id = (size === 'full')
        ? `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`
        : `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`;

    const image = new Image(`${prefixImageUrl}/${item.id}`, item.width, item.height);
    image.setProfile(Array.isArray(getProfile()) ? getProfile()[0] : getProfile());
    await setAuthenticationServices(item, image);

    const resource = new Resource(id, (size === 'full') ? item.width : null, (size === 'full') ? item.height : null,
        'image/jpeg', 'dctypes:Image');
    resource.setService(image);

    return resource;
}

async function addThumbnail(base, item) {
    const resource = await getImageResource(item, '!100,100');
    base.setThumbnail(resource);
}

function addFileTypeThumbnail(base, pronom, fileExtension, type) {
    let icon = (type === 'folder') ? defaultFolderIcon : defaultFileIcon;

    const pronomData = getPronomInfo(pronom);
    if (pronomData && pronomData.extensions) {
        const availableIcons = pronomData.extensions.filter(ext => iconsByExtension.includes(ext));
        if (availableIcons.length > 0)
            icon = availableIcons.find(ext => ext === fileExtension) || availableIcons[0];
    }

    const resource = new Resource(`${prefixIconUrl}/${icon}.svg`, null, null, 'image/svg+xml');
    base.setThumbnail(resource);
}

function setDefaults(base) {
    base.setContext();
    base.setLogo(`${prefixFileUrl}/logo`);
    if (config.attribution)
        base.setAttribution(config.attribution);
}

async function setAuthenticationServices(item, base) {
    if (await requiresAuthentication(item)) {
        await Promise.all(enabledAuthServices.map(async type => {
            const authTexts = await getAuthTexts(item, type);
            base.setService(AuthService.getAuthenticationService(prefixAuthUrl, authTexts, type));
        }));
    }
}

module.exports = {getCollection, getManifest, getReference};
