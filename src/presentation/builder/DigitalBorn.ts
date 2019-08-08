import * as path from 'path';
import * as moment from 'moment';

import config from '../../lib/Config';
import getPronomInfo, {PronomInfo} from '../../lib/Pronom';
import {getChildItems} from '../../lib/Item';
import {runTaskWithResponse} from '../../lib/Task';
import {iconsByExtension} from '../../lib/FileIcon';
import {IIIFMetadataParams} from '../../lib/Service';
import {AudioItem, FileItem, FolderItem, ImageItem, Item, PdfItem, VideoItem} from '../../lib/ItemInterfaces';
import {Access, AccessState, getEnabledAuthServices, requiresAuthentication, getAuthTexts} from '../../lib/Security';

import {IIIFMetadata} from '../../service/util/types';
import {PresentationBuilder} from './PresentationBuilder';

import Image from '../elem/v2/Image';
import Collection from '../elem/v2/Collection';
import Manifest from '../elem/v2/Manifest';
import Sequence from '../elem/v2/Sequence';
import MediaSequence from '../elem/v2/MediaSequence';
import Canvas from '../elem/v2/Canvas';
import Annotation from '../elem/v2/Annotation';
import Resource from '../elem/v2/Resource';
import Rendering from '../elem/v2/Rendering';
import AuthService from '../elem/v2/AuthService';
import Base from '../elem/v2/Base';

const defaultFileIcon = 'blank';
const defaultFolderIcon = 'folder';

const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;
const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixAuthUrl = `${config.baseUrl}/iiif/auth`;
const prefixFileUrl = `${config.baseUrl}/file`;
const prefixIconUrl = `${config.baseUrl}/file-icon`;

export async function getCollection(item: FolderItem, access: Access, builder: PresentationBuilder): Promise<Collection> {
    const label = ((access.state !== AccessState.CLOSED) || (item.collection_id === item.id))
        ? item.label : 'Access denied';
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, label);

    setDefaults(collection);

    if (item.description)
        collection.setDescription(item.description);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    await addMetadata(collection, item);

    if (access.state !== AccessState.CLOSED) {
        const children = await getChildItems(item.id);
        await Promise.all(children.map(async childItem => {
            const child = await builder.getReference(childItem);
            if (builder.isCollection(childItem))
                collection.addCollection(child as Collection);
            else if (builder.isManifest(childItem))
                collection.addManifest(child as Manifest);
        }));
    }
    else {
        await setAuthenticationServices(item, collection);
    }

    return collection;
}

export async function getManifest(item: FileItem, access: Access, builder: PresentationBuilder): Promise<Manifest> {
    const label = (access.state !== AccessState.CLOSED) ? item.label : 'Access denied';
    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, label);

    setDefaults(manifest);

    if (item.description)
        manifest.setDescription(item.description);

    if (item.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    if (access.state !== AccessState.CLOSED) {
        await addMetadata(manifest, item);

        if (item.type !== 'image') {
            const extension = item.label ? path.extname(item.label).substring(1).toLowerCase() : null;
            addFileTypeThumbnail(manifest, item.original.puid, extension, 'file');
        }

        switch (item.type) {
            case 'image':
                await addImage(manifest, item as ImageItem);
                await addThumbnail(manifest, item as ImageItem);
                break;
            case 'audio':
                await addAudio(manifest, item as AudioItem);
                break;
            case 'video':
                await addVideo(manifest, item as VideoItem);
                break;
            case 'pdf':
                await addPdf(manifest, item as PdfItem);
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

export async function getReference(item: Item, builder: PresentationBuilder): Promise<Collection | Manifest> {
    if (item.type === 'folder') {
        const childCollection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
        addFileTypeThumbnail(childCollection, null, null, 'folder');
        return childCollection;
    }

    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, item.label);

    if (item.type === 'image')
        await addThumbnail(manifest, item as ImageItem);
    else {
        const extension = item.label ? path.extname(item.label).substring(1).toLowerCase() : null;
        addFileTypeThumbnail(manifest, item.original.puid, extension, 'file');
    }

    return manifest;
}

async function addImage(manifest: Manifest, item: ImageItem): Promise<void> {
    const resource = await getImageResource(item);
    const annotation = new Annotation(`${prefixPresentationUrl}/${item.id}/annotation/0`, resource);
    const canvas = new Canvas(`${prefixPresentationUrl}/${item.id}/canvas/0`, annotation);
    const sequence = new Sequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, canvas);

    annotation.setCanvas(canvas);
    manifest.setSequence(sequence);
}

async function addAudio(manifest: Manifest, item: AudioItem): Promise<void> {
    await addMediaSequence(manifest, item, 'dctypes:Sound');
}

async function addVideo(manifest: Manifest, item: VideoItem): Promise<void> {
    await addMediaSequence(manifest, item, 'dctypes:MovingImage');
}

async function addPdf(manifest: Manifest, item: PdfItem): Promise<void> {
    await addMediaSequence(manifest, item, 'foaf:Document');
}

async function addOther(manifest: Manifest, item: FileItem): Promise<void> {
    await addMediaSequence(manifest, item, 'foaf:Document');
}

async function addMediaSequence(manifest: Manifest, item: FileItem, type: string): Promise<void> {
    const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
    const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;
    const defaultMime = accessPronomData ? accessPronomData.mime : (originalPronomData as PronomInfo).mime;

    const resource = new Resource(`${prefixFileUrl}/${item.id}`, null, null, defaultMime, type);
    const mediaSequence = new MediaSequence(`${prefixPresentationUrl}/${item.id}/sequence/0`, resource);

    if (item.access.uri && accessPronomData)
        resource.addRendering(new Rendering(`${prefixFileUrl}/${item.id}/access`, 'Access copy', accessPronomData.mime));

    if (item.original.uri && originalPronomData)
        resource.addRendering(new Rendering(`${prefixFileUrl}/${item.id}/original`, 'Original copy', originalPronomData.mime));

    await setAuthenticationServices(item, resource);
    manifest.setMediaSequence(mediaSequence);
}

async function addMetadata(base: Base, root: Item): Promise<void> {
    if (root.original.puid) {
        const pronomData = getPronomInfo(root.original.puid);
        if (pronomData)
            base.addMetadata(
                'Original file type',
                `<a href='${pronomData.url}'>${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
            );
    }

    if (root.access.puid && (root.type !== 'image')) {
        const pronomData = getPronomInfo(root.access.puid);
        if (pronomData)
            base.addMetadata(
                'Access file type',
                `<a href='${pronomData.url}'>${pronomData.name} (${pronomData.extensions.map(ext => `.${ext}`).join(', ')})</a>`
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
        const authors: { [type: string]: string[] } = root.authors.reduce((acc: { [type: string]: string[] }, author) => {
            acc[author.type] ? acc[author.type].push(author.name) : acc[author.type] = [author.name];
            return acc;
        }, {});
        Object.keys(authors).forEach(type => base.addMetadata(type, authors[type]));
    }

    if (root.dates.length > 0)
        base.addMetadata('Dates', root.dates);

    if (root.physical)
        base.addMetadata('Physical description', String(root.physical));

    if (root.metadata.length > 0)
        base.addMetadata(root.metadata);

    const md = await runTaskWithResponse<IIIFMetadataParams, IIIFMetadata>('iiif-metadata', {item: root});
    if (md.homepage)
        base.setRelated(md.homepage);

    if (md.metadata && md.metadata.length > 0)
        base.addMetadata(md.metadata);

    if (md.seeAlso && md.seeAlso.length > 0)
        base.addSeeAlso(md.seeAlso);
}

async function getImageResource(item: ImageItem, size = 'full'): Promise<Resource> {
    const id = `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`;
    const image = new Image(`${prefixImageUrl}/${item.id}`, item.width, item.height);
    await setAuthenticationServices(item, image);

    const resource = new Resource(id, (size === 'full') ? item.width : null,
        (size === 'full') ? item.height : null, 'image/jpeg', 'dctypes:Image');
    resource.setService(image);

    return resource;
}

function getLogo(size = 'full'): Resource {
    const [width, height] = config.logoDimensions as [number, number];
    const id = `${prefixImageUrl}/logo/full/${size}/0/default.png`;
    const image = new Image(`${prefixImageUrl}/logo`, width, height);

    const resource = new Resource(id, (size === 'full') ? width : null,
        (size === 'full') ? height : null, 'image/png', 'dctypes:Image');
    resource.setService(image);

    return resource;
}

async function addThumbnail(base: Base, item: ImageItem): Promise<void> {
    const resource = await getImageResource(item, '!100,100');
    base.setThumbnail(resource);
}

function addFileTypeThumbnail(base: Base, pronom: string | null, fileExtension: string | null, type: string): void {
    let icon = (type === 'folder') ? defaultFolderIcon : defaultFileIcon;

    if (pronom && fileExtension) {
        const pronomData = getPronomInfo(pronom);
        if (pronomData && pronomData.extensions) {
            const availableIcons = pronomData.extensions.filter(ext => iconsByExtension.includes(ext));
            if (availableIcons.length > 0)
                icon = availableIcons.find(ext => ext === fileExtension) || availableIcons[0];
        }
    }

    const resource = new Resource(`${prefixIconUrl}/${icon}.svg`, null, null, 'image/svg+xml');
    base.setThumbnail(resource);
}

function setDefaults(base: Base): void {
    base.setContext();
    if (config.logoRelativePath)
        base.setLogo(getLogo());
    if (config.attribution)
        base.setAttribution(config.attribution);
}

async function setAuthenticationServices(item: Item, base: Base): Promise<void> {
    if (await requiresAuthentication(item)) {
        const authTexts = await getAuthTexts(item);
        getEnabledAuthServices().forEach(type => {
            const service = AuthService.getAuthenticationService(prefixAuthUrl, authTexts, type);
            if (service)
                base.setService(service);
        });
    }
}
