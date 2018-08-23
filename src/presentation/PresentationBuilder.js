const Collection = require('./Collection');
const Manifest = require('./Manifest');
const Sequence = require('./Sequence');
const MediaSequence = require('./MediaSequence');
const Canvas = require('./Canvas');
const Annotation = require('./Annotation');
const Resource = require('./Resource');
const Rendering = require('./Rendering');
const AuthService = require('./AuthService');

const Image = require('../image/Image');
const {getProfile} = require('../image/imageServer');

const config = require('../lib/Config');
const getPronomInfo = require('../lib/Pronom');
const {getChildItems} = require('../lib/Item');
const {iconsByExtension} = require('../lib/FileIcon');
const {enabledAuthServices, requiresAuthentication, getAuthTexts} = require('../lib/Security');

const path = require('path');
const moment = require('moment');

const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;
const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixAuthUrl = `${config.baseUrl}/iiif/auth`;
const prefixFileUrl = `${config.baseUrl}/file`;
const prefixIconUrl = `${config.baseUrl}/file-icon`;

const defaultFileIcon = 'blank';
const defaultFolderIcon = 'folder';

async function getCollection(item, includeContent = true) {
    const label = includeContent ? item.label : 'Access denied';
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, label);

    collection.setContext();
    addLogo(collection);
    addLicense(collection);
    addAttribution(collection);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    if (includeContent) {
        addMetadata(collection, item);

        const children = await getChildItems(item.id);
        await Promise.all(children.map(async child => {
            if (child.type === 'folder') {
                const childCollection = new Collection(`${prefixPresentationUrl}/collection/${child.id}`, child.label);
                addFileTypeThumbnail(childCollection, null, null, 'folder');
                collection.addCollection(childCollection);
            }
            else {
                const manifest = new Manifest(`${prefixPresentationUrl}/${child.id}/manifest`, child.label);
                const extension = child.label ? path.extname(child.label).substring(1).toLowerCase() : null;

                if (child.type === 'image')
                    await addThumbnail(manifest, child);
                else
                    addFileTypeThumbnail(manifest, child.original.puid, extension, 'file');

                collection.addManifest(manifest);
            }
        }));
    }
    else {
        await setAuthenticationServices(item, collection);
    }

    return collection;
}

async function getManifest(item, includeContent = true) {
    const label = includeContent ? item.label : 'Access denied';
    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, label);

    manifest.setContext();
    addLogo(manifest);
    addLicense(manifest);
    addAttribution(manifest);

    if (item.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    if (includeContent) {
        addMetadata(manifest, item);

        if (item.type !== 'image') {
            const extension = item.original.uri ? path.extname(item.original.uri).substring(1) : null;
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

    if (accessPronomData)
        resource.addRendering(new Rendering(`${prefixFileUrl}/${item.id}/access`, 'Access copy', accessPronomData.mime));

    if (originalPronomData)
        resource.addRendering(new Rendering(`${prefixFileUrl}/${item.id}/original`, 'Original copy', originalPronomData.mime));

    await setAuthenticationServices(item, resource);
    manifest.setMediaSequence(mediaSequence);
}

async function addThumbnail(base, item) {
    const resource = await getImageResource(item, '!100,100');
    base.setThumbnail(resource);
}

async function setAuthenticationServices(item, base) {
    if (await requiresAuthentication(item)) {
        await Promise.all(enabledAuthServices.map(async type => {
            const authTexts = await getAuthTexts(item, type);
            base.setService(AuthService.getAuthenticationService(prefixAuthUrl, authTexts, type));
        }));
    }
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

function addMetadata(base, root) {
    if (root.original.puid) {
        const pronomData = getPronomInfo(root.original.puid);
        base.addMetadata(
            'File type',
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
}

function addLogo(base) {
    base.setLogo(`${prefixFileUrl}/logo`);
}

function addLicense(base) {
    // TODO: Get license
    base.setLicense('http://creativecommons.org/licenses/by-sa/3.0/');
}

function addAttribution(base) {
    if (config.attribution)
        base.setAttribution(config.attribution);
}

module.exports = {getCollection, getManifest};
