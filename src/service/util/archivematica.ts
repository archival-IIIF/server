import dayjs from 'dayjs';
import {existsSync} from 'fs';
import {basename, extname, join} from 'path';
import {parseXml, Document, Element} from 'libxmljs2';

import config from '../../lib/Config.js';
import {createItem} from '../../lib/Item.js';
import {TextItem} from '../../lib/ServiceTypes.js';
import {readdirAsync, readFileAsync} from '../../lib/Promisified.js';
import {MinimalItem, FolderItem, Item} from '../../lib/ItemInterfaces.js';

import {getTypeForPronom, pronomByExtension} from './archivematica_pronom_data.js';

export interface CollectionProcessingResult {
    rootItem: Item,
    childItems: Item[],
    textItems: TextItem[]
}

export interface TextInfo {
    type: 'translation' | 'transcription',
    language: string | null,
}

export interface Options {
    type: 'root' | 'folder' | 'custom',
    customStructMapId?: string,
    isText?: (label: string, parents: string[]) => boolean,
    getTypeAndLang?: (label: string, parents: string[]) => TextInfo,
    withRootCustomForFile?: (rootCustom: Element, fileId: string) => object,
    withRootCustomForText?: (rootCustom: Element, fileId: string) => string[],
}

interface Opts {
    type: 'root' | 'folder',
    rootCustom: Element | null,
    isText?: (label: string, parents: string[]) => boolean,
    getTypeAndLang?: (label: string, parents: string[]) => TextInfo,
    withRootCustomForFile?: (rootCustom: Element, fileId: string) => object,
    withRootCustomForText?: (rootCustom: Element, fileId: string) => string[],
}

type premis = 'premis' | 'premisv3';

export const ns = {
    'mets': 'http://www.loc.gov/METS/',
    'premis': 'info:lc/xmlns/premis-v2',
    'premisv3': 'http://www.loc.gov/premis/v3',
    'mediainfo': 'https://mediaarea.net/mediainfo',
    'fits': 'http://hul.harvard.edu/ois/xml/ns/fits/fits_output',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'IFD0': 'http://ns.exiftool.ca/EXIF/IFD0/1.0/',
    'File': 'http://ns.exiftool.ca/File/1.0/'
};

export async function processCollection(collectionPath: string, options: Options): Promise<CollectionProcessingResult> {
    const metsFile = (await readdirAsync(collectionPath)).find(file => file.startsWith('METS') && file.endsWith('xml'));
    if (!metsFile)
        throw new Error(`No METS file found in the collection ${collectionPath}`);

    const metsPath = join(collectionPath, metsFile);
    const metsXml = await readFileAsync(metsPath, 'utf8');

    const mets = parseXml(metsXml);
    const rootLogical = mets.get<Element>('//mets:structMap[@ID="structMap_2"]/mets:div/mets:div', ns);
    const rootPhysical = mets.get<Element>('//mets:structMap[@TYPE="physical"]/mets:div/mets:div', ns);
    const rootCustom = options.customStructMapId ? mets.get<Element>(
        `//mets:structMap[@ID="${options.customStructMapId}"]/mets:div`, ns) : null;
    if (!rootPhysical)
        throw new Error('Could not find the physical structmap in the METS file');

    const objectsPath = join(collectionPath, 'objects');
    const objects = existsSync(objectsPath) ? await readdirAsync(objectsPath) : [];
    const relativeRootPath = objectsPath
        .replace(`${config.dataRootPath}/${config.collectionsRelativePath}/`, '');

    const opts: Opts = {
        type: options.type === 'root' || (options.type === 'custom' && rootCustom) ? 'root' : 'folder',
        rootCustom,
        isText: options.isText,
        withRootCustomForFile: options.withRootCustomForFile,
        withRootCustomForText: options.withRootCustomForText,
    };

    const rootItem = getRootItem(mets, rootCustom, opts);
    const [childItems, textItems] = walkTree(
        rootItem.id,
        mets,
        objects,
        relativeRootPath,
        rootLogical || rootPhysical,
        rootPhysical,
        [rootItem.id],
        opts
    );

    return {rootItem, childItems, textItems};
}

function getRootItem(mets: Document, rootCustom: Element | null, opts: Opts): Item {
    const rootDir = mets.get<Element>('//mets:structMap[@TYPE="physical"]/mets:div', ns);
    if (!rootDir)
        throw new Error('Could not find the physical structmap in the METS file');

    const rootDmdIdAttr = rootDir.attr('DMDID');
    const rootDmdId = rootDmdIdAttr ? rootDmdIdAttr.value() : null;
    const premisObj = mets.get<Element>(`//mets:dmdSec[@ID="${rootDmdId}"]/mets:mdWrap/mets:xmlData/premisv3:object`, ns);
    if (!premisObj)
        throw new Error('Could not find the premis object of the root item in the METS file');

    const uuidElem = premisObj.get<Element>('./premisv3:objectIdentifier/premisv3:objectIdentifierType[text()="UUID"]/../premisv3:objectIdentifierValue', ns);
    const originalNameElem = premisObj.get<Element>('./premisv3:originalName', ns);
    if (!uuidElem || !originalNameElem)
        throw new Error('Could not find the UUID and/or original name of the root item in the METS file');

    const id = originalNameElem.text().replace(`-${uuidElem.text()}`, '');

    return createItem({
        id: id,
        collection_id: id,
        type: opts.type,
        label: id
    } as MinimalItem);
}

function walkTree(id: string, mets: Document, objects: string[], relativeRootPath: string,
                  curNode: Element, curNodePhysical: Element, parents: string[], opts: Opts): [Item[], TextItem[]] {
    let items: Item[] = [];
    let texts: TextItem[] = [];

    for (const node of curNode.find<Element>('./mets:div', ns)) {
        const label = node.attr('LABEL')?.value() || null;
        if (!label)
            throw new Error('Expected to find a label for an element in the structmap');

        const nodePhysical = curNodePhysical.get<Element>(`./mets:div[@LABEL="${label}"]`, ns) || curNodePhysical;
        const typeAttr = node.attr('TYPE');
        if (typeAttr?.value() === 'Directory') {
            const folderInfo = opts.type === 'folder' ? readFolder(id, label, mets, node, nodePhysical, parents) : null;
            if (folderInfo)
                items.push(folderInfo);

            if (folderInfo || (opts.type === 'root' && parents.length === 1)) {
                const [childItems, childTexts] = walkTree(
                    id,
                    mets,
                    objects,
                    relativeRootPath,
                    node,
                    nodePhysical,
                    [folderInfo ? folderInfo.id : label, ...parents],
                    opts
                );

                items = items.concat(childItems);
                texts = texts.concat(childTexts);
            }
        }
        else if (opts.type === 'folder' || parents[0] === 'preservation') {
            const fileInfo = readFile(id, label, mets, objects, relativeRootPath, nodePhysical, parents, opts);
            if (fileInfo)
                items.push(fileInfo);
        }
        else if (opts.type === 'root' && opts.isText && opts.isText(label, parents)) {
            const textInfo = readText(id, label, mets, objects, relativeRootPath, nodePhysical, parents, opts);
            if (textInfo)
                texts.push(textInfo);
        }
    }

    return [items, texts];
}

function readFolder(rootId: string, label: string, mets: Document, node: Element,
                    nodePhysical: Element, parents: string[]): Item | null {
    const dmdIdAttr = node.attr('DMDID') ? node.attr('DMDID') : nodePhysical.attr('DMDID');
    const dmdId = dmdIdAttr?.value() || null;
    if (!dmdId)
        return null;

    const premisObj = mets.get<Element>(`//mets:dmdSec[@ID="${dmdId}"]/mets:mdWrap/mets:xmlData/premisv3:object`, ns);
    if (!premisObj)
        throw new Error(`No premis object found for DMD id ${dmdId}`);

    const originalNameElem = premisObj.get<Element>(`./premisv3:originalName`, ns);
    if (!originalNameElem)
        throw new Error(`No original name found for object with DMD id ${dmdId}`);

    const originalName = originalNameElem.text();
    const name = basename(originalName);
    const id = getIdentifier(premisObj, 'premisv3');
    if (!id)
        throw new Error(`No identifier found for object with DMD id ${dmdId}`);

    return createItem({
        id: id,
        parent_id: parents[0],
        parent_ids: parents,
        collection_id: rootId,
        type: 'folder',
        label: name
    } as FolderItem);
}

function readFile(rootId: string, label: string, mets: Document, objects: string[], relativeRootPath: string,
                  node: Element, parents: string[], opts: Opts): Item | null {
    const fptrElem = node.get<Element>('mets:fptr', ns);
    if (!fptrElem || !fptrElem.attr('FILEID'))
        throw new Error(`Missing a fptr or file id for a file with the label ${label}`);

    const fileId = fptrElem.attr('FILEID')?.value() as string;
    const internalId = fileId.substring(5);

    const premis = findPremisNsAndObj(mets, fileId);
    if (!premis)
        return null;

    const [premisNS, premisObj] = premis;

    const originalNameElem = premisObj.get<Element>(`./${premisNS}:originalName`, ns);
    if (!originalNameElem)
        throw new Error(`No original name found for object with file id ${fileId}`);

    const originalName = originalNameElem.text();
    const id = getIdentifier(premisObj, premisNS);
    if (!id)
        throw new Error(`No identifier found for object with file id ${fileId}`);

    const [objCharacteristics, objCharacteristicsExt] = getObjCharacteristicsAndExt(premisObj, premisNS);
    if (!objCharacteristics)
        throw new Error(`No object characteristics found for object with file id ${fileId}`);

    const sizeElem = objCharacteristics.get<Element>(`./${premisNS}:size`, ns);
    const size = sizeElem ? parseInt(sizeElem.text()) : null;

    const dateCreatedByAppElem = objCharacteristics.get<Element>(`.//${premisNS}:creatingApplication/${premisNS}:dateCreatedByApplication`, ns);
    const creationDate = dateCreatedByAppElem ? dayjs(dateCreatedByAppElem.text(), 'YYYY-MM-DD').toDate() : null;

    const pronomKey = objCharacteristics.get<Element>(`./${premisNS}:format/${premisNS}:formatRegistry/${premisNS}:formatRegistryName[text()="PRONOM"]/../${premisNS}:formatRegistryKey`, ns)?.text() || null;
    const name = basename(originalName);
    const type = getTypeForPronom(pronomKey);

    if (!objCharacteristicsExt && (type === 'image' || type === 'video' || type === 'audio'))
        throw new Error(`No object characteristics extension found for object with file id ${fileId}`);

    const resolution = (type === 'image' || type === 'video')
        ? determineResolution(objCharacteristicsExt as Element)
        : {width: null, height: null};
    const dpi = (type === 'image') ? determineDpi(objCharacteristicsExt as Element) : null;
    const duration = (type === 'video' || type === 'audio') ? determineDuration(objCharacteristicsExt as Element) : null;

    const file = objects.find(f => f.startsWith(internalId));
    if (!file)
        throw new Error(`Expected to find a file starting with ${internalId}`);

    const isOriginal = file.endsWith(label);
    const extension = extname(file);

    const addItem: object =
        opts.rootCustom && opts.withRootCustomForFile &&
        opts.withRootCustomForFile(opts.rootCustom, fileId) || {};

    return createItem({
        id: id,
        parent_id: opts.type === 'root' ? rootId : parents[0],
        parent_ids: opts.type === 'root' ? [rootId] : parents,
        collection_id: rootId,
        type: type,
        label: name,
        size: size,
        created_at: creationDate,
        width: resolution.width,
        height: resolution.height,
        resolution: dpi,
        duration: duration,
        original: {
            uri: isOriginal ? join(relativeRootPath, file) : null,
            puid: pronomKey,
        },
        access: {
            uri: !isOriginal ? join(relativeRootPath, file) : null,
            puid: (!isOriginal && extension in pronomByExtension)
                ? pronomByExtension[extension] : null
        },
        ...addItem
    } as Item);
}

function readText(rootId: string, label: string, mets: Document, objects: string[], relativeRootPath: string,
                  node: Element, parents: string[], opts: Opts): TextItem | null {
    const fptrElem = node.get<Element>('mets:fptr', ns);
    if (!fptrElem || !fptrElem.attr('FILEID'))
        throw new Error(`Missing a fptr or file id for a file with the label ${label}`);

    const fileId = fptrElem.attr('FILEID')?.value() as string;
    const internalId = fileId.substring(5);
    const file = objects.find(f => f.startsWith(internalId));
    if (!file)
        throw new Error(`Expected to find a file starting with ${internalId}`);

    const premis = findPremisNsAndObj(mets, fileId);
    if (!premis)
        return null;

    const [premisNS, premisObj] = premis;

    const id = getIdentifier(premisObj, premisNS);
    if (!id)
        throw new Error(`No identifier found for object with file id ${fileId}`);

    const [objCharacteristics, objCharacteristicsExt] = getObjCharacteristicsAndExt(premisObj, premisNS);
    if (!objCharacteristics)
        throw new Error(`No object characteristics found for object with file id ${fileId}`);

    const encoding = objCharacteristicsExt ? determineEncoding(objCharacteristicsExt as Element) : null;

    const itemFileIds: string[] =
        opts.rootCustom && opts.withRootCustomForText && opts.withRootCustomForText(opts.rootCustom, fileId) || [];
    const itemFileId = itemFileIds.find(itemFileId =>
        mets.get<Element>(`//mets:structMap[@TYPE="physical"]//mets:fptr[@FILEID="${itemFileId}"]/../..`, ns)?.attr('LABEL')?.value() === 'preservation');
    if (!itemFileId)
        throw new Error(`Missing a file id for a file for the text layer with label ${label}`);

    const itemPremisObj = findPremisObj(mets, itemFileId, premisNS);
    if (!itemPremisObj)
        throw new Error(`No premis object found for file with id ${itemFileId}`);

    const itemId = getIdentifier(itemPremisObj, premisNS);
    if (!itemId)
        throw new Error(`Missing a file id for a file with id ${itemFileId}`);

    const typeAndLang = opts.getTypeAndLang && opts.getTypeAndLang(label, parents)
        || {type: 'transcription', language: null};

    return {
        id,
        itemId,
        collectionId: rootId,
        type: typeAndLang.type,
        language: typeAndLang.language,
        encoding,
        uri: join(relativeRootPath, file)
    };
}

function findPremisNsAndObj(mets: Document, fileId: string): [premis, Element] | null {
    return (['premisv3', 'premis'] as premis[])
        .map(premisNS => [premisNS, findPremisObj(mets, fileId, premisNS)])
        .find(premis => premis[1]) as [premis, Element] | null;
}

function findPremisObj(mets: Document, fileId: string, premisNS: premis = 'premis'): Element | null {
    const admId = mets.get<Element>(`mets:fileSec/mets:fileGrp[@USE="original"]/mets:file[@ID="${fileId}"]`, ns)?.attr('ADMID')?.value();
    return admId ? mets.get(`//mets:amdSec[@ID="${admId}"]/mets:techMD/mets:mdWrap/mets:xmlData/${premisNS}:object`, ns) : null;
}

export function getIdentifier(premisObj: Element, premisNS: premis = 'premis'): string | null {
    const hdlObj = premisObj.get<Element>(`./${premisNS}:objectIdentifier/${premisNS}:objectIdentifierType[text()="hdl"]`, ns);
    const uuidObj = premisObj.get<Element>(`./${premisNS}:objectIdentifier/${premisNS}:objectIdentifierType[text()="UUID"]`, ns);

    if (hdlObj) {
        const objIdAttr = hdlObj.get<Element>(`./../${premisNS}:objectIdentifierValue`, ns);
        if (objIdAttr)
            return objIdAttr.text().split('/')[1];
    }

    if (uuidObj) {
        const objIdAttr = uuidObj.get<Element>(`./../${premisNS}:objectIdentifierValue`, ns);
        if (objIdAttr)
            return objIdAttr.text();
    }

    return null;
}

export function getObjCharacteristicsAndExt(premisObj: Element, premisNS: premis = 'premis'): [Element | null, Element | null] {
    const objCharacteristics = premisObj.get<Element>(`./${premisNS}:objectCharacteristics`, ns);
    const objCharacteristicsExt = objCharacteristics
        ? objCharacteristics.get<Element>(`./${premisNS}:objectCharacteristicsExtension`, ns) : null;

    return [objCharacteristics, objCharacteristicsExt];
}

export function determineResolution(objCharacteristicsExt: Element): { width: number | null; height: number | null } {
    const mediaInfo = objCharacteristicsExt.get<Element>('./mediainfo:MediaInfo/mediainfo:media/mediainfo:track[@type="Image" or @type="Video"]', ns);
    if (mediaInfo) {
        const widthElem = mediaInfo.get<Element>('./mediainfo:Width', ns);
        const heightElem = mediaInfo.get<Element>('./mediainfo:Height', ns);

        if (widthElem && heightElem) {
            const resolution = getResolution(widthElem.text(), heightElem.text());
            if (resolution) return resolution;
        }
    }

    const ffprobe = objCharacteristicsExt.get<Element>('./ffprobe/streams/stream[@codec_type="video"]', ns);
    if (ffprobe) {
        const widthAttr = ffprobe.attr('width');
        const heightAttr = ffprobe.attr('height');

        if (widthAttr && heightAttr) {
            const resolution = getResolution(widthAttr.value(), heightAttr.value());
            if (resolution) return resolution;
        }
    }

    const exifTool = objCharacteristicsExt.get<Element>('./rdf:RDF/rdf:Description', ns);
    if (exifTool) {
        const widthElem = exifTool.get<Element>('./File:ImageWidth', ns);
        const heightElem = exifTool.get<Element>('./File:ImageHeight', ns);

        if (widthElem && heightElem) {
            const resolution = getResolution(widthElem.text(), heightElem.text());
            if (resolution) return resolution;
        }
    }

    const fitsExifTool = objCharacteristicsExt.get<Element>('./fits:fits/fits:toolOutput/fits:tool[@name="Exiftool"]/exiftool', ns);
    if (fitsExifTool) {
        const widthElem = fitsExifTool.get<Element>('./ImageWidth', ns);
        const heightElem = fitsExifTool.get<Element>('./ImageHeight', ns);

        if (widthElem && heightElem) {
            const resolution = getResolution(widthElem.text(), heightElem.text());
            if (resolution) return resolution;
        }
    }

    return {width: null, height: null};
}

function getResolution(width: string | null, height: string | null): { width: number | null; height: number | null } | null {
    if (width && height) {
        return {
            width: Number.parseInt(width),
            height: Number.parseInt(height)
        };
    }
    return null;
}

export function determineDpi(objCharacteristicsExt: Element): number | null {
    const exifTool = objCharacteristicsExt.get<Element>('./rdf:RDF/rdf:Description', ns);
    if (exifTool) {
        const resolutionElem = exifTool.get<Element>('./IFD0:XResolution', ns);

        if (resolutionElem) {
            const dpi = Number.parseInt(resolutionElem.text());
            if (dpi) return dpi;
        }
    }

    const fitsExifTool = objCharacteristicsExt.get<Element>('./fits:fits/fits:toolOutput/fits:tool[@name="Exiftool"]/exiftool', ns);
    if (fitsExifTool) {
        const resolutionElem = fitsExifTool.get<Element>('./XResolution', ns);

        if (resolutionElem) {
            const dpi = Number.parseInt(resolutionElem.text());
            if (dpi) return dpi;
        }
    }

    return null;
}

export function determineDuration(objCharacteristicsExt: Element): number | null {
    const mediaInfo = objCharacteristicsExt.get<Element>('./mediainfo:MediaInfo/mediainfo:media/mediainfo:track[@type="General"]', ns);
    if (mediaInfo) {
        const durationElem = mediaInfo.get<Element>('./mediainfo:Duration', ns);

        if (durationElem) {
            const duration = Number.parseFloat(durationElem.text());
            if (duration) return duration;
        }
    }

    let duration: number | null = null;
    for (const stream of objCharacteristicsExt.find<Element>('./ffprobe/streams/stream', ns)) {
        const durationAttr = stream.attr('duration');
        const curDuration = durationAttr ? Number.parseFloat(durationAttr.value()) : null;
        if (curDuration && (duration === null || curDuration > duration))
            duration = curDuration;
    }
    if (duration) return duration;

    return null;
}

export function determineEncoding(objCharacteristicsExt: Element): string | null {
    const md = objCharacteristicsExt.get<Element>('./fits:fits/fits:toolOutput/fits:tool[@name="Tika"]/metadata', ns);
    if (md) {
        const contentEncodingValueElem = md.get<Element>('./field[@name="Content-Encoding"]/value', ns);
        if (contentEncodingValueElem)
            return contentEncodingValueElem.text().trim();
    }

    return null;
}
