import config from '../../lib/Config';
import {getChildItems} from '../../lib/Item';
import {runTaskWithResponse} from '../../lib/Task';
import {IIIFMetadataParams} from '../../lib/Service';
import getPronomInfo, {PronomInfo} from '../../lib/Pronom';
import {FileItem, ImageItem, Item, RootItem} from '../../lib/ItemInterfaces';

import {IIIFMetadata} from '../../service/util/types';
import {PresentationBuilder} from './PresentationBuilder';

import Base from '../elem/v3/Base';
import Manifest from '../elem/v3/Manifest';
import Canvas from '../elem/v3/Canvas';
import AnnotationPage from '../elem/v3/AnnotationPage';
import Annotation from '../elem/v3/Annotation';
import Resource from '../elem/v3/Resource';
import Service from '../elem/v3/Service';

const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;
const prefixImageUrl = `${config.baseUrl}/iiif/image`;
const prefixFileUrl = `${config.baseUrl}/file`;

export async function getManifest(item: RootItem, builder: PresentationBuilder): Promise<Manifest> {
    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, item.label);

    addDefaults(manifest);
    await addMetadata(manifest, item);

    if (item.description)
        manifest.setSummary(item.description);

    if (item.parent_id)
        manifest.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`, 'Collection');

    await addContent(manifest, item);

    return manifest;
}

export async function getReference(item: RootItem, builder: PresentationBuilder): Promise<Manifest> {
    const manifest = new Manifest(`${prefixPresentationUrl}/${item.id}/manifest`, item.label);

    const items = await getChildItems(item.id, true) as FileItem[];
    const firstItem = items[0];
    addThumbnail(manifest, firstItem);

    return manifest;
}

async function addContent(manifest: Manifest, parentItem: RootItem): Promise<void> {
    const items = await getChildItems(parentItem.id, true) as FileItem[];
    const firstItem = items[0];

    addBehavior(manifest, firstItem, items.length > 1);
    addThumbnail(manifest, parentItem, firstItem);

    const manifestItems = await Promise.all(items.map(async item => {
        const page = item.order || 0;

        const resource = (item.type === 'image') ? getImageResource(item as ImageItem) : getResource(item);
        const canvas = new Canvas(`${prefixPresentationUrl}/${parentItem.id}/canvas/${page}`,
            item.width, item.height, item.duration);
        const annoPage = new AnnotationPage(`${prefixPresentationUrl}/${parentItem.id}/annopage/${page}/0`);
        const annotation = new Annotation(`${prefixPresentationUrl}/${parentItem.id}/annotation/${item.id}`, resource);

        canvas.setItems(annoPage);
        annoPage.setItems(annotation);
        annotation.setCanvas(canvas);

        await addMetadata(canvas, item);
        addThumbnail(canvas, item);

        return canvas;
    }));

    manifest.setItems(manifestItems);
}

async function addMetadata(base: Base, root: Item): Promise<void> {
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
        base.setHomepage(md.homepage.id, md.homepage.label);

    if (md.metadata && md.metadata.length > 0)
        base.addMetadata(md.metadata);

    if (md.seeAlso && md.seeAlso.length > 0)
        base.addSeeAlso(md.seeAlso);
}

function getResource(item: FileItem): Resource {
    const id = `${prefixFileUrl}/${item.id}`;

    const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
    const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;
    const defaultMime = accessPronomData ? accessPronomData.mime : (originalPronomData as PronomInfo).mime;

    return new Resource(id, getType(item), defaultMime, item.width, item.height, item.duration);
}

function getImageResource(item: ImageItem, size = 'full'): Resource {
    const id = (size === 'full')
        ? `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`
        : `${prefixImageUrl}/${item.id}/full/${size}/0/default.jpg`;

    const resource = new Resource(id, 'Image', 'image/jpeg',
        (size === 'full') ? item.width : null, (size === 'full') ? item.height : null);
    const service = new Service(`${prefixImageUrl}/${item.id}`, Service.IMAGE_SERVICE_2,
        'http://iiif.io/api/image/2/level2.json');
    resource.setService(service);

    return resource;
}

function addThumbnail(base: Base, item: RootItem | FileItem, childItem?: FileItem): void {
    if ((item.type === 'image') || (item.type === 'root' && childItem && childItem.type === 'image')) {
        const resource = getImageResource(item as ImageItem, '90,');
        base.setThumbnail(resource);
    }
}

function addBehavior(base: Base, item: Item, hasMultipleItems = true): void {
    base.addBehavior('individuals');
    base.setViewingDirection('left-to-right');
}

function addDefaults(manifest: Manifest): void {
    manifest.setContext();
    manifest.setLogo(new Resource(`${prefixFileUrl}/logo`, 'Image'));
    if (config.attribution)
        manifest.setAttribution(config.attribution);
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
