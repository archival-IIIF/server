import * as path from 'path';
import * as moment from 'moment';

import config from '../../lib/Config';
import getPronomInfo, {PronomInfo} from '../../lib/Pronom';
import {getChildItems} from '../../lib/Item';
import {runTaskWithResponse} from '../../lib/Task';
import {iconsByExtension} from '../../lib/FileIcon';
import {IIIFMetadataParams} from '../../lib/Service';
import {FileItem, FolderItem, ImageItem, Item} from '../../lib/ItemInterfaces';
import {Access, AccessState, getEnabledAuthServices, requiresAuthentication, getAuthTexts} from '../../lib/Security';

import {IIIFMetadata} from '../../service/util/types';
import {PresentationBuilder} from './PresentationBuilder';

import Base from '../elem/v3/Base';
import Manifest from '../elem/v3/Manifest';
import Collection from '../elem/v3/Collection';
import Canvas from '../elem/v3/Canvas';
import AnnotationPage from '../elem/v3/AnnotationPage';
import Annotation from '../elem/v3/Annotation';
import Resource from '../elem/v3/Resource';
import Service from '../elem/v3/Service';
import AuthService from '../elem/v3/AuthService';

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

    addDefaults(collection);
    await addMetadata(collection, item);

    if (item.description)
        collection.setSummary(item.description);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`, 'Collection');

    if (access.state !== AccessState.CLOSED) {
        const children = await getChildItems(item.id);
        await Promise.all(children.map(async childItem => {
            const child = await builder.getReference(childItem, 'v3');
            if (builder.isCollection(childItem))
                collection.addItem(child as Collection);
            else if (builder.isManifest(childItem))
                collection.addItem(child as Manifest);
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

    addDefaults(manifest);

    if (item.description)
        manifest.setSummary(item.description);

    if (item.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`, 'Collection');

    if (access.state !== AccessState.CLOSED) {
        await addMetadata(manifest, item);
        setThumbnail(manifest, item);

        const resource = (item.type === 'image') ? getImageResource(item as ImageItem) : getResource(item);
        const canvas = new Canvas(`${prefixPresentationUrl}/${item.id}/canvas/0`,
            item.width, item.height, item.duration);
        const annoPage = new AnnotationPage(`${prefixPresentationUrl}/${item.id}/annopage/0/0`);
        const annotation = new Annotation(`${prefixPresentationUrl}/${item.id}/annotation/${item.id}`, resource);

        const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
        const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;

        if (item.access.uri && accessPronomData)
            canvas.setRendering({
                id: `${prefixFileUrl}/${item.id}/access`,
                label: 'Access copy',
                format: accessPronomData.mime,
                type: getType(item)
            });

        if (item.original.uri && originalPronomData)
            canvas.setRendering({
                id: `${prefixFileUrl}/${item.id}/original`,
                label: 'Original copy',
                format: originalPronomData.mime,
                type: getType(item)
            });

        manifest.addItem(canvas);
        canvas.addItem(annoPage);
        annoPage.addItem(annotation);
        annotation.setCanvas(canvas);
    }
    else {
        await setAuthenticationServices(item, manifest);
    }

    return manifest;
}

export async function getReference(item: Item, builder: PresentationBuilder): Promise<Collection | Manifest> {
    if (item.type === 'folder') {
        const childCollection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
        childCollection.setThumbnail(getFileTypeThumbnail(null, null, 'folder'));
        return childCollection;
    }

    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, item.label);
    setThumbnail(manifest, item);

    return manifest;
}

function getResource(item: FileItem): Resource {
    const id = `${prefixFileUrl}/${item.id}`;

    const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
    const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;
    const defaultMime = accessPronomData ? accessPronomData.mime : (originalPronomData as PronomInfo).mime;

    return new Resource(id, getType(item), defaultMime, item.width, item.height, item.duration);
}

function getImageResource(item: ImageItem, size = 'full'): Resource {
    const id = `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`;
    const resource = new Resource(id, 'Image', 'image/jpeg',
        (size === 'full') ? item.width : null, (size === 'full') ? item.height : null);
    const service = new Service(`${prefixImageUrl}/${item.id}`, Service.IMAGE_SERVICE_2,
        'http://iiif.io/api/image/2/level2.json');
    resource.setService(service);

    return resource;
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

    if (root.description)
        base.addMetadata('Description', root.description);

    if (root.metadata.length > 0)
        base.addMetadata(root.metadata);

    const md = await runTaskWithResponse<IIIFMetadataParams, IIIFMetadata>('iiif-metadata', {item: root});
    if (md.homepage)
        base.setHomepage(md.homepage);

    if (md.metadata && md.metadata.length > 0)
        base.addMetadata(md.metadata);

    if (md.seeAlso && md.seeAlso.length > 0)
        base.addSeeAlso(md.seeAlso);
}

function getLogo(size = 'full'): Resource {
    const [width, height] = config.logoDimensions as [number, number];
    const id = `${prefixImageUrl}/logo/full/${size}/0/default.png`;
    const resource = new Resource(id, 'Image', 'image/png',
        (size === 'full') ? width : null, (size === 'full') ? height : null);
    const service = new Service(`${prefixImageUrl}/logo`, Service.IMAGE_SERVICE_2,
        'http://iiif.io/api/image/2/level2.json');
    resource.setService(service);

    return resource;
}

function getImageThumbnail(item: ImageItem): Resource {
    return getImageResource(item, '90,');
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

    return new Resource(`${prefixIconUrl}/${icon}.svg`, 'Image', 'image/svg+xml');
}

function setThumbnail(base: Base, item: Item) {
    if (item.type === 'image')
        base.setThumbnail(getImageThumbnail(item as ImageItem));
    else {
        const extension = item.label ? path.extname(item.label).substring(1).toLowerCase() : null;
        base.setThumbnail(getFileTypeThumbnail(item.original.puid, extension, 'file'));
    }
}

function addDefaults(base: Base): void {
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

function getType(item: FileItem): string {
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
