import dayjs from 'dayjs';
import * as path from 'node:path';

import {Base, Collection, Manifest, Resource} from '@archival-iiif/presentation-builder/v3';

import {runLib} from '../lib/Task.js';
import fileFormatCollection from '../lib/Pronom.js';
import {getChildItems} from '../lib/Item.js';
import {iconsByExtension} from '../lib/FileIcon.js';
import {Access, AccessState} from '../lib/Security.js';
import {BasicIIIFMetadata, ItemParams} from '../lib/ServiceTypes.js';
import {Item, FolderItem, FileItem, ImageItem} from '../lib/ItemInterfaces.js';

import {
    createMinimalCollection,
    createMinimalManifest,
    createCollection,
    createManifest,
    createCanvas,
    addMetadata,
    addThumbnail,
    getType,
    setAuthServices
} from './PresentationUtils.js';
import {PresentationBuilder} from './PresentationBuilder.js';
import {accessUri, iconUri, originalUri} from './UriHelper.js';

const defaultFileIcon = 'blank';
const defaultFolderIcon = 'folder';

export async function getCollection(item: FolderItem, access: Access, builder: PresentationBuilder): Promise<Collection> {
    const md = await runLib<ItemParams, BasicIIIFMetadata>('basic-iiif-metadata', {item});
    const label = ((access.state !== AccessState.CLOSED) || (item.collection_id === item.id))
        ? item.label : 'Access denied';
    const collection = await createCollection(item, label);

    await addMetadataDB(collection, item, md);

    if (access.state !== AccessState.CLOSED) {
        const children = await getChildItems(item);
        collection.setItems(await Promise.all(children.map(async child =>
            await builder.getReference(child) as Collection | Manifest)));
    }
    else {
        await setAuthServices(collection, item);
    }

    return collection;
}

export async function getManifest(item: FileItem, access: Access): Promise<Manifest> {
    const label = (access.state !== AccessState.CLOSED) ? item.label : 'Access denied';
    const manifest = await createManifest(item, label);

    if (access.state !== AccessState.CLOSED) {
        const md = await runLib<ItemParams, BasicIIIFMetadata>('basic-iiif-metadata', {item});

        manifest.setBehavior('unordered');
        await addMetadataDB(manifest, item, md);
        await setThumbnail(manifest, item);

        const canvas = await createCanvas(item, item);
        manifest.setItems(canvas);

        const accessPronomData = item.access.puid ? fileFormatCollection.get(item.access.puid) : undefined;
        const originalPronomData = item.original.puid ? fileFormatCollection.get(item.original.puid) : undefined;

        if (item.access.uri && accessPronomData)
            canvas.setRendering({
                id: accessUri(item.id),
                label: 'Access copy',
                format: accessPronomData.mime,
                type: getType(item.type)
            });

        if (item.original.uri && originalPronomData)
            canvas.setRendering({
                id: originalUri(item.id),
                label: 'Original copy',
                format: originalPronomData.mime,
                type: getType(item.type)
            });
    }
    else {
        await setAuthServices(manifest, item);
    }

    return manifest;
}

export async function getReference(item: Item): Promise<Collection | Manifest> {
    if (item.type === 'folder') {
        const childCollection = createMinimalCollection(item);
        childCollection.setThumbnail(getFileTypeThumbnail(null, null, 'folder'));

        return childCollection;
    }

    const manifest = createMinimalManifest(item);
    await setThumbnail(manifest, item);

    return manifest;
}

async function addMetadataDB(base: Base, root: Item, md: BasicIIIFMetadata): Promise<void> {
    if (root.original.puid) {
        const pronomData = fileFormatCollection.get(root.original.puid);
        if (pronomData)
            base.setMetadata(
                'Original file type',
                `<a href='${pronomData.url}'>${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
            );
    }

    if (root.access.puid && (root.type !== 'image')) {
        const pronomData = fileFormatCollection.get(root.access.puid);
        if (pronomData)
            base.setMetadata(
                'Access file type',
                `<a href='${pronomData.url}'>${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
            );
    }

    if (root.size && root.created_at) {
        const steps = Math.floor(Math.log(root.size) / Math.log(1024));
        const fileSize = `${(root.size / Math.pow(1024, steps)).toFixed(2)} ${['bytes', 'KB', 'MB', 'GB', 'TB'][steps]}`;
        base.setMetadata('Original file size', root.size > 0 ? fileSize : '0 bytes');

        const date = dayjs(root.created_at).format('MMMM Do YYYY');
        base.setMetadata('Original modification date', date);
    }

    await addMetadata(base, root, md);
}

async function setThumbnail(base: Base, item: Item) {
    if (item.type === 'image')
        await addThumbnail(base, item as ImageItem);
    else {
        const extension = item.label ? path.extname(item.label).substring(1).toLowerCase() : null;
        base.setThumbnail(getFileTypeThumbnail(item.original.puid, extension, 'file'));
    }
}

function getFileTypeThumbnail(pronom: string | null, fileExtension: string | null, type: string): Resource {
    let icon = (type === 'folder') ? defaultFolderIcon : defaultFileIcon;

    if (pronom && fileExtension) {
        const pronomData = fileFormatCollection.get(pronom);
        if (pronomData && pronomData.extensions) {
            const availableIcons = pronomData.extensions.filter(ext => iconsByExtension.includes(ext));
            if (availableIcons.length > 0)
                icon = availableIcons.find(ext => ext === fileExtension) || availableIcons[0];
        }
    }

    return new Resource(iconUri(icon), 'Image', 'image/svg+xml');
}
