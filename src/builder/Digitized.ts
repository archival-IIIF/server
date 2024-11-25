import {runLib} from '../lib/Task.js';
import {getWordsFromStructure} from '../lib/TextStructure.js';
import {Item, RootItem, FileItem} from '../lib/ItemInterfaces.js';
import {BasicIIIFMetadata, ItemParams} from '../lib/ServiceTypes.js';
import {getTextsForCollectionId, Text, withTexts} from '../lib/Text.js';
import {getChildItems, getRangeItemsByCollectionId} from '../lib/Item.js';

import {
    Base, Canvas, Service, Manifest, Resource,
    Annotation, AnnotationPage, AnnotationCollection
} from '@archival-iiif/presentation-builder/v3';

import {
    createMinimalManifest,
    createManifest,
    createCanvas,
    addThumbnail,
    addMetadata,
    addStructures,
    createAnnotationPage,
} from './PresentationUtils.js';

import {
    annoCollUri,
    annoPageUri,
    annoUri,
    fileUri,
    searchUri,
    autocompleteUri,
    textUri,
    textPlainUri
} from './UriHelper.js';

export async function getManifest(parentItem: RootItem): Promise<Manifest> {
    const manifest = await createManifest(parentItem);

    const items = await getChildItems(parentItem) as FileItem[];
    const ranges = await getRangeItemsByCollectionId(parentItem.id);
    const texts = await withTexts(getTextsForCollectionId(parentItem.id));
    const md = await runLib<ItemParams, BasicIIIFMetadata>('basic-iiif-metadata', {item: parentItem});

    addBehavior(manifest, parentItem, md, items.length > 1);
    await addThumbnail(manifest, parentItem);
    await addMetadata(manifest, parentItem, md);

    manifest.setItems(await Promise.all(items.map(async (item, idx) => {
        const md = await runLib<ItemParams, BasicIIIFMetadata>('basic-iiif-metadata', {item});
        const canvas = await createCanvas(item, parentItem, idx === 0);

        texts
            .filter(text => text.item_id === item.id)
            .forEach(text => addText(canvas, parentItem, text));

        await addThumbnail(canvas, item);
        await addMetadata(canvas, item, md);

        return canvas;
    })));

    await addStructures(manifest, parentItem, items, ranges);

    if (texts.length > 0)
        setSearchService(manifest, parentItem);

    return manifest;
}

export async function getReference(item: RootItem): Promise<Manifest> {
    return createMinimalManifest(item);
}

export async function getAnnotationPage(item: RootItem, text: Text): Promise<AnnotationPage> {
    const annoPage = createAnnotationPage(item, text);

    const items = await getChildItems(item) as FileItem[];
    const texts = await withTexts(getTextsForCollectionId(item.id, text.type, text.language));

    const childItem = items.find(item => item.id === text.item_id) as FileItem;
    const canvas = await createCanvas(childItem, item);

    const firstItem = items.reduce<Text | undefined>((acc, item) =>
        acc || texts.find(text => item.id === text.item_id), undefined);
    const lastItem = items.reverse().reduce<Text | undefined>((acc, item) =>
        acc || texts.find(text => item.id === text.item_id), undefined);

    const prevItem = items.reverse().reduce<Text | undefined>((acc, item) =>
        acc || (item.order && childItem.order && item.order < childItem.order
            && texts.find(text => item.id === text.item_id)) || undefined, undefined);
    const nextItem = items.reduce<Text | undefined>((acc, item) =>
        acc || (item.order && childItem.order && item.order > childItem.order
            && texts.find(text => item.id === text.item_id)) || undefined, undefined);

    const annoCollection = new AnnotationCollection(annoCollUri(item.id, text.type, text.language));

    annoCollection.setLabel(text.type === 'transcription' ? 'Transcription' : `Translation ${text.language}`);
    annoCollection.setFirstAndLast('AnnotationPage',
        firstItem ? annoPageUri(item.id, firstItem.id) : undefined,
        lastItem ? annoPageUri(item.id, lastItem.id) : undefined
    );

    annoPage.setParent(annoCollection);
    annoPage.setPrevAndNext('AnnotationPage',
        prevItem ? annoPageUri(item.id, prevItem.id) : undefined,
        nextItem ? annoPageUri(item.id, nextItem.id) : undefined
    );

    setSearchService(annoPage, text);
    setSearchService(annoCollection, item, text.type, text.language);

    if (text.structure) {
        const annotations: Annotation[] = [];

        for (const word of getWordsFromStructure(text.structure)) {
            if (word.x && word.y && word.width && word.height) {
                const resource = Resource.createTextResource(word.content, text.language);
                const annotation = new Annotation(annoUri(item.id, childItem.id, word.idx), resource, 'supplementing');

                if (word.content.split(/\s+/).filter(w => w.length > 0).length > 1){

                    annotation.setTextGranularity('line');
                }else{
                    annotation.setTextGranularity('word');
                }

                annotation.setCanvas(canvas, {x: word.x, y: word.y, w: word.width, h: word.height});

                annotations.push(annotation);
            }
        }

        annoPage.setItems(annotations);
    }
    else {
        const resource = Resource.createTextResource(text.text, text.language);
        const annotation = new Annotation(annoUri(item.id, childItem.id), resource, 'supplementing');

        annotation.setTextGranularity('page');
        annotation.setCanvas(canvas);

        annoPage.setItems(annotation);
    }

    return annoPage;
}

function addBehavior(manifest: Manifest, item: Item, md: BasicIIIFMetadata, hasMultipleItems = true): void {
    manifest.setViewingDirection('left-to-right');
    manifest.setBehavior(hasMultipleItems && md.behavior ? md.behavior : 'individuals');
}

function addText(canvas: Canvas, item: Item, text: Text): void {
    const label = text.type === 'transcription' ? 'Transcription' : `Translation ${text.language}`;

    const annoPage = new AnnotationPage(annoPageUri(item.id, text.id));
    canvas.setAnnotations(annoPage);

    canvas.setSeeAlso({
        id: fileUri(text.id),
        type: 'Text',
        format: text.source === 'alto' ? 'application/xml' : 'plain/text',
        profile: text.source === 'alto' ? 'http://www.loc.gov/standards/alto/' : undefined,
        label: text.source === 'alto' ? 'ALTO XML' : label
    });

    canvas.setRendering({
        id: textPlainUri(text.id),
        label,
        format: 'plain/text',
        type: 'Text'
    });

    canvas.setMetadata(label, `<a href="${textUri(text.id)}">Open in new window</a>`);
}

function setSearchService(base: Base, item: Item | Text, type?: string, language?: string | null): void {
    const service = new Service(
        searchUri(item.id, type, language),
        Service.SEARCH_SERVICE_1,
        'http://iiif.io/api/search/1/search'
    );

    service.setService(new Service(
        autocompleteUri(item.id, type, language),
        Service.AUTOCOMPLETE_SERVICE_1,
        'http://iiif.io/api/search/1/autocomplete'
    ));

    base.setService(service);
}
