import dayjs from 'dayjs';
import {existsSync} from 'fs';
import {basename, extname, join} from 'path';
import {parseXml, Element} from 'libxmljs2';

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
    isFile?: (label: string, parents: string[]) => boolean,
    isText?: (label: string, parents: string[]) => boolean,
    getTypeAndLang?: (label: string, parents: string[]) => TextInfo,
    withRootCustomForFile?: (rootCustom: Element, fileId: string) => object,
    withRootCustomForText?: (rootCustom: Element, fileId: string) => string,
}

interface Opts {
    type: 'root' | 'folder',
    rootCustom: Element | null,
    relativeRootPath: string;
    objects: string[],
    directoryMetadata: Map<string, Metadata>,
    objectsMetadata: Map<string, ObjectMetadata>,
    objectMapping: Map<string, string>,
    isFile?: (label: string, parents: string[]) => boolean,
    isText?: (label: string, parents: string[]) => boolean,
    getTypeAndLang?: (label: string, parents: string[]) => TextInfo,
    withRootCustomForFile?: (rootCustom: Element, fileId: string) => object,
    withRootCustomForText?: (rootCustom: Element, fileId: string) => string,
}

interface TreeNode {
    children: Map<string, ChildTreeNode>;
}

interface ChildTreeNode extends TreeNode {
    id?: string;
    label: string;
    isDirectory: boolean;
}

interface Metadata {
    id: string;
    name: string;
}

interface ObjectMetadata extends Metadata {
    type: string;
    size: number | null;
    creationDate: Date | null;
    pronomKey: string | null;
    width: number | null;
    height: number | null;
    resolution: number | null;
    duration: number | null;
    encoding: string | null;
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
    const rootLogical = mets.get<Element>('/mets:mets/mets:structMap[@ID="structMap_2"]/mets:div/mets:div', ns);
    const rootPhysical = mets.get<Element>('/mets:mets/mets:structMap[@TYPE="physical"]/mets:div/mets:div', ns);
    const rootCustom = options.customStructMapId ? mets.get<Element>(
        `/mets:mets/mets:structMap[@ID="${options.customStructMapId}"]/mets:div`, ns) : null;
    if (!rootPhysical)
        throw new Error('Could not find the physical structmap in the METS file');

    const objectsPath = join(collectionPath, 'objects');
    const objects = existsSync(objectsPath) ? await readdirAsync(objectsPath) : [];
    const relativeRootPath = objectsPath
        .replace(`${config.dataRootPath}/${config.collectionsRelativePath}/`, '');

    const directoryMetadata = createDirectoryMetadata(mets.root()!);
    const objectsMetadata = createObjectsMetadata(mets.root()!);
    const objectMapping = createObjectMapping(mets.root()!);

    const rootNode: TreeNode = {children: new Map()};
    rootLogical && createTreeLogical(rootNode, rootLogical);
    createTreePhysical(rootNode, rootPhysical);

    const type = options.type === 'root' || (options.type === 'custom' && rootCustom) ? 'root' : 'folder';
    const rootItem = getRootItem(mets.root()!, directoryMetadata, type);

    const [childItems, textItems] = walkTree(rootNode, rootItem.id, {
        type,
        rootCustom,
        relativeRootPath,
        objects,
        directoryMetadata,
        objectsMetadata,
        objectMapping,
        isFile: options.isFile,
        isText: options.isText,
        withRootCustomForFile: options.withRootCustomForFile,
        withRootCustomForText: options.withRootCustomForText,
    });

    return {rootItem, childItems, textItems};
}

function createTreeLogical(parent: TreeNode, curNode: Element) {
    for (const node of curNode.find<Element>('./mets:div', ns)) {
        const current = withTreeNode(parent, node);
        if (current.isDirectory)
            createTreeLogical(current, node);
    }
}

function createTreePhysical(parent: TreeNode, curNode: Element) {
    for (const node of curNode.find<Element>('./mets:div', ns)) {
        const current = withTreeNode(parent, node);
        if (current.isDirectory)
            createTreePhysical(current, node);
        else {
            const fptrElem = node.get<Element>('mets:fptr', ns);
            if (!fptrElem || !fptrElem.attr('FILEID'))
                throw new Error(`Missing a fptr or file id for a file with the label ${current.label}`);

            current.id = fptrElem.attr('FILEID')?.value();
        }
    }
}

function withTreeNode(parent: TreeNode, node: Element): ChildTreeNode {
    const label = node.attr('LABEL')?.value();
    if (!label)
        throw new Error('Expected to find a label for an element in the structmap');

    if (parent.children.has(label)) {
        const current = parent.children.get(label)!;
        if (current.isDirectory && !current.id)
            current.id = node.attr('DMDID')?.value();
        return current;
    }

    const isDirectory = node.attr('TYPE')?.value() === 'Directory';
    const id = isDirectory ? node.attr('DMDID')?.value() : undefined;

    const current = {id, label, isDirectory, children: new Map()};
    parent.children.set(label, current);

    return current;
}

function createDirectoryMetadata(mets: Element): Map<string, Metadata> {
    const metadata = new Map<string, Metadata>();

    for (const node of mets.find<Element>('/mets:mets/mets:dmdSec', ns)) {
        const dmdId = node.attr('ID')?.value();
        if (!dmdId)
            throw new Error('A dmdSec is missing an ID');

        const premisObj = node.get<Element>('./mets:mdWrap/mets:xmlData/premisv3:object', ns);
        if (!premisObj)
            throw new Error(`No premis object found for DMD id ${dmdId}`);

        metadata.set(dmdId, getPremisMetadata(dmdId, premisObj, 'premisv3'));
    }

    return metadata;
}

function createObjectsMetadata(mets: Element): Map<string, ObjectMetadata> {
    const metadata = new Map<string, ObjectMetadata>();

    for (const node of mets.find<Element>('/mets:mets/mets:amdSec', ns)) {
        const amdId = node.attr('ID')?.value();
        if (!amdId)
            throw new Error('An amdSec is missing an ID');

        const premis = (['premisv3', 'premis'] as premis[])
            .map<[premis, Element | null]>(premisNS =>
                [premisNS, node.get<Element>(`./mets:techMD/mets:mdWrap/mets:xmlData/${premisNS}:object`, ns)])
            .find(premis => premis[1]) as [premis, Element] | undefined;
        if (!premis)
            throw new Error(`No premis object found for AMD id ${amdId}`);

        const [premisNS, premisObj] = premis;
        const premisMetadata = getPremisMetadata(amdId, premisObj, premisNS);

        const objCharacteristics = premisObj.get<Element>(`./${premisNS}:objectCharacteristics`, ns);
        if (!objCharacteristics)
            throw new Error(`No object characteristics found for AMD id ${amdId}`);

        const objCharacteristicsExt = objCharacteristics.get<Element>(`./${premisNS}:objectCharacteristicsExtension`, ns);

        const sizeText = objCharacteristics.get<Element>(`./${premisNS}:size`, ns)?.text();
        const size = sizeText ? parseInt(sizeText) : null;

        const dateCreatedByAppText = objCharacteristics.get<Element>(`.//${premisNS}:creatingApplication/${premisNS}:dateCreatedByApplication`, ns)?.text();
        const creationDate = dateCreatedByAppText ? dayjs(dateCreatedByAppText, 'YYYY-MM-DD').toDate() : null;

        const pronomKey = objCharacteristics.get<Element>(`./${premisNS}:format/${premisNS}:formatRegistry/${premisNS}:formatRegistryName[text()="PRONOM"]/../${premisNS}:formatRegistryKey`, ns)?.text() || null;
        const name = basename(premisMetadata.name);
        const type = getTypeForPronom(pronomKey);

        if (!objCharacteristicsExt && (type === 'image' || type === 'video' || type === 'audio'))
            throw new Error(`No object characteristics extension found for AMD id ${amdId}`);

        const {width, height} = (type === 'image' || type === 'video')
            ? determineResolution(objCharacteristicsExt!)
            : {width: null, height: null};
        const resolution = (type === 'image') ? determineDpi(objCharacteristicsExt!) : null;
        const duration = (type === 'video' || type === 'audio') ? determineDuration(objCharacteristicsExt!) : null;
        const encoding = objCharacteristicsExt ? determineEncoding(objCharacteristicsExt) : null;

        metadata.set(amdId, {
            id: premisMetadata.id,
            name,
            type,
            size,
            creationDate,
            pronomKey,
            width,
            height,
            resolution,
            duration,
            encoding
        });
    }

    return metadata;
}

function getPremisMetadata(nodeId: string, node: Element, premisNS: premis): Metadata {
    const originalNameElem = node.get<Element>(`./${premisNS}:originalName`, ns);
    if (!originalNameElem)
        throw new Error(`No original name found for ${nodeId}`);

    const originalName = originalNameElem.text();
    const name = basename(originalName);
    const id = getIdentifier(node, premisNS);
    if (!id)
        throw new Error(`No identifier found for ${nodeId}`);

    return {id, name};
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

function getResolution(width: string | null, height: string | null): {
    width: number | null;
    height: number | null
} | null {
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
        const durationValue = stream.attr('duration')?.value();
        const curDuration = durationValue ? Number.parseFloat(durationValue) : null;
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

function createObjectMapping(mets: Element): Map<string, string> {
    const mapping = new Map<string, string>();

    for (const node of mets.find<Element>('/mets:mets/mets:fileSec/mets:fileGrp[@USE="original"]/mets:file', ns)) {
        mapping.set(
            node.attr('ID')?.value()!,
            node.attr('ADMID')?.value()!
        );
    }

    return mapping;
}

function getRootItem(mets: Element, directoryMetadata: Map<string, Metadata>, type: string): Item {
    const rootDir = mets.get<Element>('//mets:structMap[@TYPE="physical"]/mets:div', ns);
    if (!rootDir)
        throw new Error('Could not find the physical structmap in the METS file');

    const rootDmdId = rootDir.attr('DMDID')?.value();
    const metadata = directoryMetadata.get(rootDmdId!);
    if (!metadata)
        throw new Error(`Could not find the root metadata for DMD id ${rootDmdId}`);

    const id = metadata.name.replace(`-${metadata.id}`, '');
    return createItem({id, collection_id: id, type, label: id} as MinimalItem);
}

function walkTree(curNode: TreeNode, rootId: string, opts: Opts, parents: string[] = []): [Item[], TextItem[]] {
    const items: Item[] = [];
    const texts: TextItem[] = [];

    if (parents.length === 0)
        parents = [rootId];

    for (const node of curNode.children.values()) {
        if (node.isDirectory)
            withDirectory(node, items, texts, rootId, opts, parents);
        else if (opts.type === 'folder' || (opts.type === 'root' && (!opts.isFile || opts.isFile(node.label, parents))))
            withFile(node, items, rootId, opts, parents);
        else if (opts.type === 'root' && opts.isText && opts.isText(node.label, parents))
            withTextFile(node, texts, rootId, opts, parents);
    }

    return [items, texts];
}

function withDirectory(node: ChildTreeNode, items: Item[], texts: TextItem[],
                       rootId: string, opts: Opts, parents: string[]) {
    const directoryMetadata = opts.directoryMetadata.get(node.id!);
    if (node.id && !directoryMetadata)
        throw Error(`No premis object found for DMD id ${node.id}`);

    const addDirectory = opts.type === 'folder' && directoryMetadata;
    if (addDirectory) {
        items.push(createItem({
            id: directoryMetadata.id,
            parent_id: parents[0],
            parent_ids: parents,
            collection_id: rootId,
            type: 'folder',
            label: directoryMetadata.name
        } as FolderItem));
    }

    if ((opts.type === 'folder' && directoryMetadata) || (opts.type === 'root' && parents.length === 1)) {
        const [childItems, childTexts] = walkTree(
            node, rootId, opts, [addDirectory ? directoryMetadata.id : node.label, ...parents]);

        items.push(...childItems);
        texts.push(...childTexts);
    }
}

function withFile(node: ChildTreeNode, items: Item[], rootId: string, opts: Opts, parents: string[]) {
    const amdId = opts.objectMapping.get(node.id!);
    const objectMetadata = opts.objectsMetadata.get(amdId!);
    if (objectMetadata) {
        const internalId = node.id?.substring(5)!;
        const file = opts.objects.find(f => f.startsWith(internalId));
        if (!file)
            throw new Error(`Expected to find a file starting with ${internalId}`);

        const isOriginal = file.endsWith(node.label);
        const extension = extname(file);

        const addItem = opts.rootCustom && opts.withRootCustomForFile &&
            opts.withRootCustomForFile(opts.rootCustom, node.id!) || {};

        items.push(createItem({
            id: objectMetadata.id,
            parent_id: opts.type === 'root' ? rootId : parents[0],
            parent_ids: opts.type === 'root' ? [rootId] : parents,
            collection_id: rootId,
            type: objectMetadata.type,
            label: objectMetadata.name,
            size: objectMetadata.size,
            created_at: objectMetadata.creationDate,
            width: objectMetadata.width,
            height: objectMetadata.height,
            resolution: objectMetadata.resolution,
            duration: objectMetadata.duration,
            original: {
                uri: isOriginal ? join(opts.relativeRootPath, file) : null,
                puid: objectMetadata.pronomKey,
            },
            access: {
                uri: !isOriginal ? join(opts.relativeRootPath, file) : null,
                puid: (!isOriginal && extension in pronomByExtension)
                    ? pronomByExtension[extension] : null
            },
            ...addItem
        } as Item));
    }
}

function withTextFile(node: ChildTreeNode, texts: TextItem[], rootId: string, opts: Opts, parents: string[]) {
    const amdId = opts.objectMapping.get(node.id!);
    const objectMetadata = opts.objectsMetadata.get(amdId!);
    if (objectMetadata) {
        const internalId = node.id?.substring(5)!;
        const file = opts.objects.find(f => f.startsWith(internalId));
        if (!file)
            throw new Error(`Expected to find a file starting with ${internalId}`);

        const itemFileId = opts.rootCustom && opts.withRootCustomForText &&
            opts.withRootCustomForText(opts.rootCustom, node.id!);
        if (!itemFileId)
            throw new Error(`Missing a file id for a file for the text layer with label ${node.label}`);

        const itemObjectMetadata = opts.objectsMetadata.get(opts.objectMapping.get(itemFileId)!);
        if (!itemObjectMetadata)
            throw new Error(`Missing premis metadata for file id ${itemFileId}`);

        const {type, language} = opts.getTypeAndLang && opts.getTypeAndLang(node.label, parents)
        || {type: 'transcription', language: null};

        texts.push({
            id: objectMetadata.id,
            itemId: itemObjectMetadata.id,
            collectionId: rootId,
            type,
            language,
            encoding: objectMetadata.encoding,
            uri: join(opts.relativeRootPath, file)
        });
    }
}
