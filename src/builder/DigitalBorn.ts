import * as path from 'path';
import moment from 'moment';

import getPronomInfo from '../lib/Pronom';
import {getChildItems} from '../lib/Item';
import {iconsByExtension} from '../lib/FileIcon';
import {Item, FolderItem, FileItem, ImageItem} from '../lib/ItemInterfaces';
import {Access, AccessState, getEnabledAuthServices, requiresAuthentication, getAuthTexts} from '../lib/Security';

import {
    createMinimalCollection,
    createMinimalManifest,
    createCollection,
    createManifest,
    createCanvas,
    addMetadata,
    addThumbnail,
    getType
} from './PresentationUtils';
import {PresentationBuilder} from './PresentationBuilder';
import {accessUri, authUri, iconUri, originalUri} from './UriHelper';

import Base, {Ref} from './elem/v3/Base';
import Manifest from './elem/v3/Manifest';
import Collection from './elem/v3/Collection';
import Resource from './elem/v3/Resource';
import AuthService from './elem/v3/AuthService';

const defaultFileIcon = 'blank';
const defaultFolderIcon = 'folder';

export async function getCollection(item: FolderItem, access: Access, builder: PresentationBuilder): Promise<Collection> {
    const label = ((access.state !== AccessState.CLOSED) || (item.collection_id === item.id))
        ? item.label : 'Access denied';
    const collection = await createCollection(item, label);

    await addMetadataDB(collection, item);

    if (access.state !== AccessState.CLOSED) {
        const children = await getChildItems(item);
        collection.setItems(await Promise.all(children.map(async child =>
            await builder.getReference(child) as Ref)));
    }
    else {
        await setAuthenticationServices(item, collection);
    }

    return collection;
}

export async function getManifest(item: FileItem, access: Access): Promise<Manifest> {
    const label = (access.state !== AccessState.CLOSED) ? item.label : 'Access denied';
    const manifest = await createManifest(item, label);

    if (access.state !== AccessState.CLOSED) {
        manifest.setBehavior('unordered');
        await addMetadataDB(manifest, item);
        await setThumbnail(manifest, item);

        const canvas = await createCanvas(item, item);
        manifest.setItems(canvas);

        const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
        const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;

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
        await setAuthenticationServices(item, manifest);
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

async function setAuthenticationServices(item: Item, base: Base): Promise<void> {
    if (await requiresAuthentication(item)) {
        const authTexts = await getAuthTexts(item);
        for (const type of getEnabledAuthServices()) {
            const service = AuthService.getAuthenticationService(authUri, authTexts, type);
            if (service)
                base.setService(service);
        }
    }
}

async function addMetadataDB(base: Base, root: Item): Promise<void> {
    if (root.original.puid) {
        const pronomData = getPronomInfo(root.original.puid);
        if (pronomData)
            base.setMetadata(
                'Original file type',
                `<a href='${pronomData.url}'>${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
            );
    }

    if (root.access.puid && (root.type !== 'image')) {
        const pronomData = getPronomInfo(root.access.puid);
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

        const date = moment(root.created_at).format('MMMM Do YYYY');
        base.setMetadata('Original modification date', date);
    }

    await addMetadata(base, root);
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
        const pronomData = getPronomInfo(pronom);
        if (pronomData && pronomData.extensions) {
            const availableIcons = pronomData.extensions.filter(ext => iconsByExtension.includes(ext));
            if (availableIcons.length > 0)
                icon = availableIcons.find(ext => ext === fileExtension) || availableIcons[0];
        }
    }

    return new Resource(iconUri(icon), 'Image', 'image/svg+xml');
}
