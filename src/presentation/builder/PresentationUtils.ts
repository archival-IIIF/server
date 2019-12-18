import {existsSync} from 'fs';

import {IIIFMetadata} from '../../service/util/types';

import config from '../../lib/Config';
import {getDerivativePath, getItem} from '../../lib/Item';
import {runTaskWithResponse} from '../../lib/Task';
import {IIIFMetadataParams} from '../../lib/Service';
import getPronomInfo, {PronomInfo} from '../../lib/Pronom';
import {Item, FileItem, ImageItem, RootItem} from '../../lib/ItemInterfaces';

import Base from '../elem/v3/Base';
import Manifest from '../elem/v3/Manifest';
import Collection from '../elem/v3/Collection';
import Canvas from '../elem/v3/Canvas';
import Resource from '../elem/v3/Resource';
import Service from '../elem/v3/Service';
import Annotation from '../elem/v3/Annotation';
import AnnotationPage from '../elem/v3/AnnotationPage';

export const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;
export const prefixImageUrl = `${config.baseUrl}/iiif/image`;
export const prefixFileUrl = `${config.baseUrl}/file`;

export function createMinimalCollection(item: Item, label?: string): Collection {
    return new Collection(`${prefixPresentationUrl}/collection/${item.id}`, label || item.label);
}

export function createMinimalManifest(item: Item, label?: string): Manifest {
    return new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, label || item.label);
}

export async function createCollection(item: Item, label?: string): Promise<Collection> {
    const collection = createMinimalCollection(item, label);
    await setBaseDefaults(collection, item);

    return collection;
}

export async function createManifest(item: Item, label?: string): Promise<Manifest> {
    const manifest = createMinimalManifest(item, label);
    await setBaseDefaults(manifest, item);

    return manifest;
}

export async function createCanvas(item: FileItem, parentItem: Item): Promise<Canvas> {
    const idPrefix = `${prefixPresentationUrl}/${parentItem.id}`;
    const page = item.order || 0;

    const resource = getResource(item);
    const canvas = new Canvas(`${idPrefix}/canvas/${page}`, item.width, item.height, item.duration);
    const annoPage = new AnnotationPage(`${idPrefix}/annopage/${page}/0`);
    const annotation = new Annotation(`${idPrefix}/annotation/${item.id}`, resource);

    canvas.setItems(annoPage);
    annoPage.setItems(annotation);
    annotation.setCanvas(canvas);

    addDerivatives(annotation, item);

    return canvas;
}

export function getResource(item: FileItem): Resource {
    if (item.type === 'image')
        return getImageResource(item as ImageItem);

    const id = `${prefixFileUrl}/${item.id}`;

    const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
    const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;
    const defaultMime = accessPronomData ? accessPronomData.mime : (originalPronomData as PronomInfo).mime;

    return new Resource(id, getType(item), defaultMime, item.width, item.height, item.duration);
}

export function addThumbnail(base: Base, item: RootItem | FileItem, childItem?: FileItem): void {
    if ((item.type === 'image') || (item.type === 'root' && childItem && childItem.type === 'image')) {
        const resource = getImageResource(item as ImageItem, '90,');
        base.setThumbnail(resource);
    }
}

export async function addMetadata(base: Base, root: Item): Promise<void> {
    if (root.authors.length > 0) {
        const authors: { [type: string]: string[] } = root.authors.reduce((acc: { [type: string]: string[] }, author) => {
            acc[author.type] ? acc[author.type].push(author.name) : acc[author.type] = [author.name];
            return acc;
        }, {});
        Object.keys(authors).forEach(type => base.setMetadata(type, authors[type]));
    }

    if (root.dates.length > 0)
        base.setMetadata('Dates', root.dates);

    if (root.physical)
        base.setMetadata('Physical description', String(root.physical));

    if (root.description)
        base.setMetadata('Description', root.description);

    root.metadata.forEach(md => base.setMetadata(md.label, md.value));

    const md = await runTaskWithResponse<IIIFMetadataParams, IIIFMetadata>('iiif-metadata', {item: root});
    if (md.homepage)
        base.setHomepage(md.homepage);

    if (md.metadata && md.metadata.length > 0)
        md.metadata.forEach(metadata => base.setMetadata(metadata.label, metadata.value));

    if (md.seeAlso && md.seeAlso.length > 0)
        base.setSeeAlso(md.seeAlso);
}

export function getType(item: FileItem): string {
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

async function setBaseDefaults(base: Base, item: Item): Promise<void> {
    addDefaults(base);

    if (item.description)
        base.setSummary(item.description);

    if (item.parent_id) {
        const parentItem = await getItem(item.parent_id);
        if (parentItem)
            base.setParent(`${prefixPresentationUrl}/collection/${parentItem.id}`,
                'Collection', parentItem.label);
    }
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

function addDefaults(manifest: Manifest): void {
    manifest.setContext();

    if (config.logoRelativePath)
        manifest.setLogo(getLogo());

    if (config.attribution)
        manifest.setAttribution(config.attribution);
}

function addDerivatives(annotation: Annotation, item: Item): void {
    if (item.type === 'audio') {
        const waveFormFile = getDerivativePath(item, 'waveform', 'dat');

        if (existsSync(waveFormFile)) {
            annotation.setSeeAlso({
                id: `${prefixFileUrl}/${item.id}/waveform`,
                type: 'Dataset',
                format: 'application/octet-stream',
                profile: 'http://waveform.prototyping.bbc.co.uk'
            });
        }
    }
}
