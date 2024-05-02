import {existsSync} from 'fs';

import {Text} from '../lib/Text.js';
import config from '../lib/Config.js';
import {runLib} from '../lib/Task.js';
import getPronomInfo from '../lib/Pronom.js';
import derivatives from '../lib/Derivative.js';
import {getFullDerivativePath, getItem} from '../lib/Item.js';
import {ItemParams, BasicIIIFMetadata, CanvasIIIFMetadata} from '../lib/ServiceTypes.js';
import {getAuthTexts, requiresAuthentication} from '../lib/Security.js';
import {Item, FileItem, ImageItem, RootItem, FolderItem, RangeItem} from '../lib/ItemInterfaces.js';

import {
    Base, Manifest, Collection, AuthService, Range,
    Canvas, Resource, Service, Annotation, AnnotationPage
} from '@archival-iiif/presentation-builder/v3';

import {
    annoPageUri,
    annoUri,
    authUri,
    canvasUri,
    rangeUri,
    collectionUri,
    derivativeUri,
    fileUri,
    imageResourceUri,
    imageUri,
    manifestUri
} from './UriHelper.js';
import {getStaticImageInfo} from './Image.js';

type HierarchyType = { range: RangeItem, children: HierarchyType[], items: Item[] };

export function createMinimalCollection(item: Item, label?: string): Collection {
    return new Collection(collectionUri(item.id), label || item.label);
}

export function createMinimalManifest(item: Item, label?: string): Manifest {
    return new Manifest(manifestUri(item.id), label || item.label);
}

export function createMinimalAnnotationPage(item: Item, text: Text): AnnotationPage {
    return new AnnotationPage(annoPageUri(item.id, text.id));
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

export function createAnnotationPage(item: Item, text: Text): AnnotationPage {
    const annotationPage = createMinimalAnnotationPage(item, text);
    annotationPage.setContext();

    return annotationPage;
}

export async function createCanvas(item: FileItem, parentItem: Item, setAuth: boolean = false): Promise<Canvas> {
    const canvasInfo = await runLib<ItemParams, CanvasIIIFMetadata>('canvas-iiif-metadata', {item});

    const canvas = new Canvas(canvasUri(parentItem.id, item.order || 0), canvasInfo.label,
        item.width, item.height, item.duration);
    if (canvasInfo.behavior)
        canvas.setBehavior(canvasInfo.behavior);

    const annoPage = new AnnotationPage(annoPageUri(parentItem.id, item.id));
    canvas.setItems(annoPage);

    const resource = await getResource(item, setAuth);
    const annotation = new Annotation(annoUri(parentItem.id, item.id), resource);
    annoPage.setItems(annotation);
    annotation.setCanvas(canvas);

    addDerivatives(annotation, item);

    return canvas;
}

export async function addStructures(manifest: Manifest, parentItem: Item,
                                    items: Item[], ranges: RangeItem[]): Promise<void> {
    const hierarchyById: { [id: string]: HierarchyType } = {};
    const hierarchy: HierarchyType[] = items
        .flatMap(item => item.range_ids)
        .reduce<HierarchyType[]>((acc, id) => {
            let range = ranges.find(r => r.id === id);
            if (!(id in hierarchyById) && range) {
                let addToAcc = true;
                let toAdd: HierarchyType = {
                    range,
                    children: [],
                    items: items.filter(item => item.range_ids.includes(id))
                };

                hierarchyById[id] = toAdd;
                range = ranges.find(r => r.id === range?.parent_id);
                while (range) {
                    const curHierarchy = range.id in hierarchyById
                        ? hierarchyById[range.id]
                        : {range, children: [], items: []};
                    curHierarchy.children.push(toAdd);

                    if (range.id in hierarchyById)
                        addToAcc = false;
                    else
                        hierarchyById[range.id] = curHierarchy;

                    range = ranges.find(r => r.id === range?.parent_id);
                    toAdd = curHierarchy;
                }

                if (addToAcc)
                    acc.push(toAdd);
            }
            return acc;
        }, []);

    let i = 1;
    const createRangeId = () => rangeUri(parentItem.id, i++);

    const structures = await Promise.all(hierarchy.map(curLevel =>
        createRange(curLevel, parentItem.id, createRangeId)))
    structures.length > 0 && manifest.setStructures(structures);
}

async function createRange(curLevel: HierarchyType, rootId: string, createRangeId: () => string): Promise<Range> {
    const range = new Range(createRangeId(), curLevel.range.label);

    const children = await Promise.all(curLevel.children.map(childLevel =>
        createRange(childLevel, rootId, createRangeId)));
    const canvases = curLevel.items.map(item => new Canvas(canvasUri(rootId, item.order || 0)));
    range.setItems([...children, ...canvases]);

    if (curLevel.range.description)
        range.setSummary(curLevel.range.description);

    await addMetadata(range, curLevel.range);

    return range;
}

export async function getResource(item: FileItem, setAuth: boolean = false): Promise<Resource> {
    if (item.type === 'image')
        return getImageResource(item as ImageItem, 'full', setAuth);

    const accessPronomData = item.access.puid ? getPronomInfo(item.access.puid) : null;
    const originalPronomData = item.original.puid ? getPronomInfo(item.original.puid) : null;
    const defaultMime = accessPronomData?.mime || originalPronomData?.mime || 'application/octet-stream';

    const resource = Resource.createResource(fileUri(item.id), getType(item.type), defaultMime,
        item.width, item.height, item.duration);
    setAuth && await setAuthServices(resource, item);

    return resource;
}

export async function addThumbnail(base: Base, item: RootItem | FileItem): Promise<void> {
    const resource = await getImageResource(item, '200,');
    base.setThumbnail(resource);
}

export async function addMetadata(base: Base, root: Item, md?: BasicIIIFMetadata): Promise<void> {
    if (root.authors.length > 0) {
        const authors = root.authors.reduce((acc: { [type: string]: string[] }, author) => {
            if (!acc[author.type])
                acc[author.type] = [];

            Array.isArray(author.name)
                ? acc[author.type].push(...author.name)
                : acc[author.type].push(author.name);

            return acc;
        }, {});

        for (const type of Object.keys(authors))
            base.setMetadata(type, authors[type]);
    }

    if (root.dates.length > 0)
        base.setMetadata(root.dates.length > 1 ? 'Dates' : 'Date', root.dates);

    if (root.physical)
        base.setMetadata('Physical description', String(root.physical));

    if (root.description)
        base.setMetadata('Description', root.description);

    for (const md of root.metadata)
        base.setMetadata(md.label, md.value);

    if (md) {
        if (md.rights)
            base.setRights(md.rights);

        if (md.homepage && md.homepage.length > 0)
            base.setHomepage(md.homepage);

        if (md.metadata && md.metadata.length > 0)
            for (const metadata of md.metadata)
                base.setMetadata(metadata.label, metadata.value);

        if (md.seeAlso && md.seeAlso.length > 0)
            base.setSeeAlso(md.seeAlso);
    }
}

export function getType(type: string): string {
    switch (type) {
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

export async function setAuthServices(base: Base | Service, item: RootItem | FileItem | FolderItem): Promise<void> {
    if (await requiresAuthentication(item)) {
        const authTexts = await getAuthTexts(item);
        for (const type of ['login', 'external'] as ('login' | 'external')[]) {
            const service = AuthService.getAuthenticationService(authUri, authTexts, type);
            if (service)
                base.setService(service);
        }
    }
}

async function setBaseDefaults(base: Base, item: Item): Promise<void> {
    await addDefaults(base);

    if (item.description)
        base.setSummary(item.description);

    if (item.parent_id) {
        const parentItem = await getItem(item.parent_id);
        if (parentItem)
            base.setParent(collectionUri(parentItem.id), 'Collection', parentItem.label);
    }
}

async function getImageResource(item: RootItem | FileItem, size = 'max', setAuth: boolean = false): Promise<Resource> {
    const width = (size === 'full' || size === 'max') ? item.width : null;
    const height = (size === 'full' || size === 'max') ? item.height : null;

    const resource = Resource.createResource(
        imageResourceUri(item.id, undefined, {size}),
        'Image', 'image/jpeg', width, height);
    const service = new Service(imageUri(item.id), Service.IMAGE_SERVICE_2, 'http://iiif.io/api/image/2/level2.json');
    resource.setService(service);
    setAuth && await setAuthServices(service, item);

    return resource;
}

async function getLogo(size = 'max'): Promise<Resource> {
    const imageInfo = await getStaticImageInfo('logo');

    const width = (size === 'full' || size === 'max') ? imageInfo.width : null;
    const height = (size === 'full' || size === 'max') ? imageInfo.height : null;

    const resource = Resource.createResource(
        imageResourceUri('logo', undefined, {size, format: 'png'}),
        'Image', 'image/png', width, height);
    const service = new Service(imageUri('logo'), Service.IMAGE_SERVICE_2, 'http://iiif.io/api/image/2/level2.json');

    resource.setService(service);

    return resource;
}

async function addDefaults(base: Base): Promise<void> {
    base.setContext();

    if (config.logoRelativePath)
        base.setLogo(await getLogo());

    if (config.attribution)
        base.setAttribution(config.attribution);
}

function addDerivatives(annotation: Annotation, item: Item): void {
    const filteredTypes = Object.values(derivatives)
        .filter(info => info.from === item.type && (info.to !== 'image' || info.imageTier))
        .filter(info => info.type === 'waveform'); // TODO: Only waveforms for now

    for (const info of filteredTypes) {
        const path = getFullDerivativePath(item, info);
        if (existsSync(path)) {
            annotation.setSeeAlso({
                id: derivativeUri(item.id, 'waveform'),
                type: getType(info.to),
                format: info.contentType,
                profile: info.profile
            });
        }
    }
}
