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

const {db} = require('../lib/DB');
const config = require('../lib/Config');
const getPronomInfo = require('../lib/Pronom');
const {iconsByExtension} = require('../lib/FileIcon');
const {enabledAuthServices, requiresAuthentication, getAuthTexts} = require('../lib/Security');

const path = require('path');

const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;
const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixAuthUrl = `${config.baseUrl}/iiif/auth`;
const prefixFileUrl = `${config.baseUrl}/file`;
const prefixIconUrl = `${config.baseUrl}/file-icon`;

const defaultFileIcon = 'blank';
const defaultFolderIcon = 'folder';

const collectionSql = `
        SELECT parent.id as id, parent.parent_id, parent.label as label, 
        child.id as child_id, child.type as child_type, child.label as child_label, 
        child.original_resolver as child_original_resolver, child.original_pronom as child_original_pronom
        FROM items as parent 
        LEFT JOIN items as child ON parent.id = child.parent_id 
        WHERE parent.id = $1 AND parent.type = 'folder';`;

const manifestSql = "SELECT * FROM items WHERE id = $1 AND type <> 'folder';";

async function getCollection(id) {
    const data = await db.query(collectionSql, [id]);
    if (data.length === 0)
        return null;

    const root = data[0];
    const collection = new Collection(`${prefixPresentationUrl}/collection/${root.id}`, root.label);

    collection.setContext();
    addLogo(collection);
    addMetadata(collection, root);

    if (root.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${root.parent_id}`);

    data.forEach(child => {
        if (child.child_type === 'folder') {
            const childCollection = new Collection(`${prefixPresentationUrl}/collection/${child.child_id}`, child.child_label);
            addFileTypeThumbnail(childCollection, null, null, 'folder');
            collection.addCollection(childCollection);
        }
        else if (child.child_type) {
            const manifest = new Manifest(`${prefixPresentationUrl}/${child.child_id}/manifest`, child.child_label);
            const extension = child.child_original_resolver
                ? path.extname(child.child_original_resolver).substring(1) : null;
            addFileTypeThumbnail(manifest, child.child_original_pronom, extension, 'file');
            collection.addManifest(manifest);
        }
    });

    return collection;
}

async function getManifest(id) {
    const data = await db.query(manifestSql, [id]);
    if (data.length === 0)
        return null;

    const root = data[0];
    const manifest = new Manifest(`${prefixPresentationUrl}/${root.id}/manifest`, root.label);

    manifest.setContext();
    addLogo(manifest);
    addMetadata(manifest, root);

    if (root.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${root.parent_id}`);

    if (root.type !== 'image') {
        const extension = root.original_resolver
            ? path.extname(root.original_resolver).substring(1) : null;
        addFileTypeThumbnail(manifest, root.original_pronom, extension, 'file');
    }

    switch (root.type) {
        case "image":
            await addImage(manifest, root);
            await addThumbnail(manifest, root);
            break;
        case "audio":
            await addAudio(manifest, root);
            break;
        case "video":
            await addVideo(manifest, root);
            break;
        case "pdf":
            await addPdf(manifest, root);
            break;
        default:
            await addOther(manifest, root);
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
    await addMediaSequence(manifest, item, 'audio/mp3', 'dctypes:Sound');
}

async function addVideo(manifest, item) {
    await addMediaSequence(manifest, item, 'video/mp4', 'dctypes:MovingImage');
}

async function addPdf(manifest, item) {
    await addMediaSequence(manifest, item, 'application/pdf', 'foaf:Document');
}

async function addOther(manifest, item) {
    const pronom = item.access_pronom || item.original_pronom;
    const pronomData = getPronomInfo(pronom);
    await addMediaSequence(manifest, item, pronomData ? pronomData.mime : null, 'foaf:Document');
}

async function addMediaSequence(manifest, item, mime, type) {
    const itemId = `${prefixFileUrl}/${item.id}`;
    const rendering = new Rendering(itemId, mime);
    const resource = new Resource(itemId, null, null, mime, type, rendering);
    const mediaSequence = new MediaSequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, resource);

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
    if (root.metadata)
        base.addMetadata(root.metadata);

    if (root.original_pronom) {
        const pronomData = getPronomInfo(root.original_pronom);
        base.addMetadata(
            'File type',
            `<a href="${pronomData.url}">${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
        );
    }
}

function addLogo(base) {
    base.setLogo(`${prefixFileUrl}/logo`);
}

module.exports = {getCollection, getManifest};
