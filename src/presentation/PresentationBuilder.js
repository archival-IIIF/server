const Collection = require('./Collection');
const Manifest = require('./Manifest');
const Sequence = require('./Sequence');
const MediaSequence = require('./MediaSequence');
const Canvas = require('./Canvas');
const Annotation = require('./Annotation');
const Resource = require('./Resource');
const pool = require('../lib/DB');
const config = require('../lib/Config');
const Druid = require('../lib/Druid');
const imageServer = config.imageServerUrl ? require('../image/external') : require('../image/internal');

const fs = require('fs');
const path = require('path');

const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;
const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixFileUrl = `${config.baseUrl}/file`;
const prefixIconUrl = `${config.baseUrl}/file-icon`;

const defaultFileIcon = "blank";
const defaultFolderIcon = "folder";

const collectionSql = `
        SELECT parent.id as id, parent.parent_id, parent.label as label, 
        child.id as child_id, child.type as child_type, child.label as child_label, 
        child.original_pronom as child_original_pronom
        FROM manifest as parent 
        LEFT JOIN manifest as child ON parent.id = child.parent_id 
        WHERE parent.id = $1 AND parent.type = 'folder';`;

const manifestSql = "SELECT * FROM manifest WHERE id = $1 AND type <> 'folder';";

async function getCollection(id) {
    const data = await pool.query(collectionSql, [id]);
    if (data.rows.length === 0)
        return null;

    const root = data.rows[0];
    const collection = new Collection(`${prefixPresentationUrl}/collection/${root.id}`, root.label);

    addLogo(collection);
    addMetadata(collection, root);

    if (root.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${root.parent_id}`);

    data.rows.forEach(child => {
        if (child.child_type === 'folder') {
            const childCollection = new Collection(`${prefixPresentationUrl}/collection/${child.child_id}`, child.child_label);
            addFileTypeThumbnail(childCollection, null, 'folder');
            collection.addCollection(childCollection);
        }
        else if (child.child_type) {
            const manifest = new Manifest(`${prefixPresentationUrl}/${child.child_id}/manifest`, child.child_label);
            addFileTypeThumbnail(manifest, child.child_original_pronom, 'file');
            collection.addManifest(manifest);
        }
    });

    return collection.get();
}

async function getManifest(id) {
    const data = await pool.query(manifestSql, [id]);
    if (data.rows.length === 0)
        return null;

    const root = data.rows[0];
    const manifest = new Manifest(`${prefixPresentationUrl}/${root.id}/manifest`, root.label);

    addLogo(manifest);
    addMetadata(manifest, root);

    if (root.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${root.parent_id}`);

    if (root.type !== 'image')
        addFileTypeThumbnail(manifest, root.original_pronom, 'file');

    switch (root.type) {
        case "image":
            const imageInfo = (await imageServer.getInfo(id)).info;
            addImage(manifest, root, imageInfo);
            addThumbnail(manifest, id, imageInfo);
            break;
        case "audio":
            addAudio(manifest, root);
            break;
        case "video":
            addVideo(manifest, root);
            break;
        case "pdf":
            addPdf(manifest, root);
            break;
        default:
            addOther(manifest, root);
    }

    return manifest.get();
}

function addImage(manifest, item, imageInfo) {
    const resource = Resource.getImageResource(item.id, prefixImageUrl, imageInfo);
    const annotation = new Annotation(`${prefixPresentationUrl}/${item.id}/annotation/0`, resource);
    const canvas = new Canvas(`${prefixPresentationUrl}/${item.id}/canvas/0`, annotation);
    const sequence = new Sequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, canvas);

    annotation.setCanvas(canvas);
    manifest.setSequence(sequence);
}

function addAudio(manifest, item) {
    const resource = new Resource(`${prefixFileUrl}/${item.id}`, null, null, 'audio/mp3', 'dctypes:Sound');
    const mediaSequence = new MediaSequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, resource);

    resource.setRendering();
    manifest.setMediaSequence(mediaSequence);
}

function addVideo(manifest, item) {
    const resource = new Resource(`${prefixFileUrl}/${item.id}`, null, null, 'video/mp4', 'dctypes:MovingImage');
    const mediaSequence = new MediaSequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, resource);

    resource.setRendering();
    manifest.setMediaSequence(mediaSequence);
}

function addPdf(manifest, item) {
    const resource = new Resource(`${prefixFileUrl}/${item.id}`, null, null, 'application/pdf', 'foaf:Document');
    const mediaSequence = new MediaSequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, resource);

    resource.setRendering();
    manifest.setMediaSequence(mediaSequence);
}

function addOther(manifest, item) {
    const pronom = item.access_pronom || item.original_pronom;
    const pronomData = Druid.getByPuid(pronom);

    const resource = new Resource(`${prefixFileUrl}/${item.id}`, null, null, pronomData ? pronomData.mime : null, 'foaf:Document');
    const mediaSequence = new MediaSequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, resource);

    manifest.setMediaSequence(mediaSequence);
}

function addThumbnail(base, id, imageInfo) {
    const resource = Resource.getImageResource(id, prefixImageUrl, imageInfo, '!100,100');

    base.setThumbnail(resource);
}

function addFileTypeThumbnail(base, pronom, type) {
    let icon = (type === 'folder') ? defaultFolderIcon : defaultFileIcon;

    const pronomData = Druid.getByPuid(pronom);
    if (pronomData && pronomData.extensions)
        icon = pronomData.extensions.find(
            ext => fs.existsSync(path.join(__dirname, '../../node_modules/file-icon-vectors/dist/icons/vivid', `${ext}.svg`))) || defaultFileIcon;

    const resource = new Resource(`${prefixIconUrl}/${icon}.svg`, null, null, 'image/svg+xml');
    base.setThumbnail(resource);
}

function addMetadata(base, root) {
    if (root.metadata)
        base.addMetadata(root.metadata);

    if (root.original_pronom) {
        const pronomData = Druid.getByPuid(root.original_pronom);
        base.addMetadata(
            'File type',
            `<a href="${pronomData.url}">${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
        );
    }
}

function addLogo(base) {
    base.addLogo(`${prefixFileUrl}/logo`);
}

module.exports = {getCollection, getManifest};
