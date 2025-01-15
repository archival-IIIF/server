import dayjs from 'dayjs';
import {existsSync} from 'node:fs';
import {readdir, readFile} from 'node:fs/promises';
import {basename, extname, join} from 'node:path';
import {XmlDocument, XmlNode} from 'libxml2-wasm';

import config from '../../lib/Config.js';
import {createItem} from '../../lib/Item.js';
import {TextItem} from '../../lib/ServiceTypes.js';
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
    withRootCustomForFile?: (rootCustom: XmlNode, fileId: string) => object,
    withRootCustomForText?: (rootCustom: XmlNode, fileId: string) => string,
}

interface Opts {
    type: 'root' | 'folder',
    rootCustom: XmlNode | null,
    relativeRootPath: string;
    objects: string[],
    directoryMetadata: Map<string, Metadata>,
    objectsMetadata: Map<string, ObjectMetadata>,
    objectMapping: Map<string, string>,
    isFile?: (label: string, parents: string[]) => boolean,
    isText?: (label: string, parents: string[]) => boolean,
    getTypeAndLang?: (label: string, parents: string[]) => TextInfo,
    withRootCustomForFile?: (rootCustom: XmlNode, fileId: string) => object,
    withRootCustomForText?: (rootCustom: XmlNode, fileId: string) => string,
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
    const metsFile = (await readdir(collectionPath)).find(file => file.startsWith('METS') && file.endsWith('xml'));
    if (!metsFile)
        throw new Error(`No METS file found in the collection ${collectionPath}`);

    const metsPath = join(collectionPath, metsFile);
    using mets = XmlDocument.fromBuffer(await readFile(metsPath));

    const rootLogical = mets.get('/mets:mets/mets:structMap[@ID="structMap_2"]/mets:div/mets:div', ns);
    const rootPhysical = mets.get('/mets:mets/mets:structMap[@TYPE="physical"]/mets:div/mets:div', ns);
    const rootCustom = options.customStructMapId ? mets.get(
        `/mets:mets/mets:structMap[@ID="${options.customStructMapId}"]/mets:div`, ns) : null;
    if (!rootPhysical)
        throw new Error('Could not find the physical structmap in the METS file');

    const objectsPath = join(collectionPath, 'objects');
    const objects = existsSync(objectsPath) ? await readdir(objectsPath) : [];
    const relativeRootPath = objectsPath
        .replace(`${config.dataRootPath}/${config.collectionsRelativePath}/`, '');

    const directoryMetadata = createDirectoryMetadata(mets);
    const objectsMetadata = createObjectsMetadata(mets);
    const objectMapping = createObjectMapping(mets);

    const rootNode: TreeNode = {children: new Map()};
    rootLogical && createTreeLogical(rootNode, rootLogical);
    createTreePhysical(rootNode, rootPhysical);

    const type = options.type === 'root' || (options.type === 'custom' && rootCustom) ? 'root' : 'folder';
    const rootItem = getRootItem(mets, directoryMetadata, type);

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

function createTreeLogical(parent: TreeNode, curNode: XmlNode) {
    for (const node of curNode.find('./mets:div', ns)) {
        const current = withTreeNode(parent, node);
        if (current.isDirectory)
            createTreeLogical(current, node);
    }
}

function createTreePhysical(parent: TreeNode, curNode: XmlNode) {
    for (const node of curNode.find('./mets:div', ns)) {
        const current = withTreeNode(parent, node);
        if (current.isDirectory)
            createTreePhysical(current, node);
        else {
            const fptrElem = node.get('mets:fptr', ns);
            if (!fptrElem || !fptrElem.get('@FILEID'))
                throw new Error(`Missing a fptr or file id for a file with the label ${current.label}`);

            current.id = fptrElem.get('@FILEID')?.content;
        }
    }
}

function withTreeNode(parent: TreeNode, node: XmlNode): ChildTreeNode {
    const label = node.get('@LABEL')?.content;
    if (!label)
        throw new Error('Expected to find a label for an element in the structmap');

    if (parent.children.has(label)) {
        const current = parent.children.get(label)!;
        if (current.isDirectory && !current.id)
            current.id = node.get('@DMDID')?.content;
        return current;
    }

    const isDirectory = node.get('@TYPE')?.content === 'Directory';
    const id = isDirectory ? node.get('@DMDID')?.content : undefined;

    const current = {id, label, isDirectory, children: new Map()};
    parent.children.set(label, current);

    return current;
}

function createDirectoryMetadata(mets: XmlDocument): Map<string, Metadata> {
    const metadata = new Map<string, Metadata>();

    for (const node of mets.find('/mets:mets/mets:dmdSec', ns)) {
        const dmdId = node.get('@ID')?.content;
        if (!dmdId)
            throw new Error('A dmdSec is missing an ID');

        const premisObj = node.get('./mets:mdWrap/mets:xmlData/premisv3:object', ns);
        if (!premisObj)
            throw new Error(`No premis object found for DMD id ${dmdId}`);

        metadata.set(dmdId, getPremisMetadata(dmdId, premisObj, 'premisv3'));
    }

    return metadata;
}

function createObjectsMetadata(mets: XmlDocument): Map<string, ObjectMetadata> {
    const metadata = new Map<string, ObjectMetadata>();

    for (const node of mets.find('/mets:mets/mets:amdSec', ns)) {
        const amdId = node.get('@ID')?.content;
        if (!amdId)
            throw new Error('An amdSec is missing an ID');

        const premis = (['premisv3', 'premis'] as premis[])
            .map<[premis, XmlNode | null]>(premisNS =>
                [premisNS, node.get(`./mets:techMD/mets:mdWrap/mets:xmlData/${premisNS}:object`, ns)])
            .find(premis => premis[1]) as [premis, XmlNode] | undefined;
        if (!premis)
            throw new Error(`No premis object found for AMD id ${amdId}`);

        const [premisNS, premisObj] = premis;
        const premisMetadata = getPremisMetadata(amdId, premisObj, premisNS);

        const objCharacteristics = premisObj.get(`./${premisNS}:objectCharacteristics`, ns);
        if (!objCharacteristics)
            throw new Error(`No object characteristics found for AMD id ${amdId}`);

        const objCharacteristicsExt = objCharacteristics.get(`./${premisNS}:objectCharacteristicsExtension`, ns);

        const sizeText = objCharacteristics.get(`./${premisNS}:size`, ns)?.content;
        const size = sizeText ? parseInt(sizeText) : null;

        const dateCreatedByAppText = objCharacteristics.get(`.//${premisNS}:creatingApplication/${premisNS}:dateCreatedByApplication`, ns)?.content;
        const creationDate = dateCreatedByAppText ? dayjs(dateCreatedByAppText, 'YYYY-MM-DD').toDate() : null;

        const pronomKey = objCharacteristics.get(`./${premisNS}:format/${premisNS}:formatRegistry/${premisNS}:formatRegistryName[text()="PRONOM"]/../${premisNS}:formatRegistryKey`, ns)?.content || null;
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

function getPremisMetadata(nodeId: string, node: XmlNode, premisNS: premis): Metadata {
    const originalNameElem = node.get(`./${premisNS}:originalName`, ns);
    if (!originalNameElem)
        throw new Error(`No original name found for ${nodeId}`);

    const originalName = originalNameElem.content;
    const name = basename(originalName);
    const id = getIdentifier(node, premisNS);
    if (!id)
        throw new Error(`No identifier found for ${nodeId}`);

    return {id, name};
}

export function getIdentifier(premisObj: XmlNode, premisNS: premis = 'premis'): string | null {
    const hdlObj = premisObj.get(`./${premisNS}:objectIdentifier/${premisNS}:objectIdentifierType[text()="hdl"]`, ns);
    const uuidObj = premisObj.get(`./${premisNS}:objectIdentifier/${premisNS}:objectIdentifierType[text()="UUID"]`, ns);

    if (hdlObj) {
        const objIdAttr = hdlObj.get(`./../${premisNS}:objectIdentifierValue`, ns);
        if (objIdAttr)
            return objIdAttr.content.split('/')[1];
    }

    if (uuidObj) {
        const objIdAttr = uuidObj.get(`./../${premisNS}:objectIdentifierValue`, ns);
        if (objIdAttr)
            return objIdAttr.content;
    }

    return null;
}

export function determineResolution(objCharacteristicsExt: XmlNode): { width: number | null; height: number | null } {
    const mediaInfo = objCharacteristicsExt.get('./mediainfo:MediaInfo/mediainfo:media/mediainfo:track[@type="Image" or @type="Video"]', ns);
    if (mediaInfo) {
        const widthElem = mediaInfo.get('./mediainfo:Width', ns);
        const heightElem = mediaInfo.get('./mediainfo:Height', ns);

        if (widthElem && heightElem) {
            const resolution = getResolution(widthElem.content, heightElem.content);
            if (resolution) return resolution;
        }
    }

    const ffprobe = objCharacteristicsExt.get('./ffprobe/streams/stream[@codec_type="video"]', ns);
    if (ffprobe) {
        const widthAttr = ffprobe.get('@width');
        const heightAttr = ffprobe.get('@height');

        if (widthAttr && heightAttr) {
            const resolution = getResolution(widthAttr.content, heightAttr.content);
            if (resolution) return resolution;
        }
    }

    const exifTool = objCharacteristicsExt.get('./rdf:RDF/rdf:Description', ns);
    if (exifTool) {
        const widthElem = exifTool.get('./File:ImageWidth', ns);
        const heightElem = exifTool.get('./File:ImageHeight', ns);

        if (widthElem && heightElem) {
            const resolution = getResolution(widthElem.content, heightElem.content);
            if (resolution) return resolution;
        }
    }

    const fitsExifTool = objCharacteristicsExt.get('./fits:fits/fits:toolOutput/fits:tool[@name="Exiftool"]/exiftool', ns);
    if (fitsExifTool) {
        const widthElem = fitsExifTool.get('./ImageWidth', ns);
        const heightElem = fitsExifTool.get('./ImageHeight', ns);

        if (widthElem && heightElem) {
            const resolution = getResolution(widthElem.content, heightElem.content);
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

export function determineDpi(objCharacteristicsExt: XmlNode): number | null {
    const exifTool = objCharacteristicsExt.get('./rdf:RDF/rdf:Description', ns);
    if (exifTool) {
        const resolutionElem = exifTool.get('./IFD0:XResolution', ns);

        if (resolutionElem) {
            const dpi = Number.parseInt(resolutionElem.content);
            if (dpi) return dpi;
        }
    }

    const fitsExifTool = objCharacteristicsExt.get('./fits:fits/fits:toolOutput/fits:tool[@name="Exiftool"]/exiftool', ns);
    if (fitsExifTool) {
        const resolutionElem = fitsExifTool.get('./XResolution', ns);

        if (resolutionElem) {
            const dpi = Number.parseInt(resolutionElem.content);
            if (dpi) return dpi;
        }
    }

    return null;
}

export function determineDuration(objCharacteristicsExt: XmlNode): number | null {
    const mediaInfo = objCharacteristicsExt.get('./mediainfo:MediaInfo/mediainfo:media/mediainfo:track[@type="General"]', ns);
    if (mediaInfo) {
        const durationElem = mediaInfo.get('./mediainfo:Duration', ns);

        if (durationElem) {
            const duration = Number.parseFloat(durationElem.content);
            if (duration) return duration;
        }
    }

    let duration: number | null = null;
    for (const stream of objCharacteristicsExt.find('./ffprobe/streams/stream', ns)) {
        const durationValue = stream.get('@duration')?.content;
        const curDuration = durationValue ? Number.parseFloat(durationValue) : null;
        if (curDuration && (duration === null || curDuration > duration))
            duration = curDuration;
    }
    if (duration) return duration;

    return null;
}

export function determineEncoding(objCharacteristicsExt: XmlNode): string | null {
    const md = objCharacteristicsExt.get('./fits:fits/fits:toolOutput/fits:tool[@name="Tika"]/metadata', ns);
    if (md) {
        const contentEncodingValueElem = md.get('./field[@name="Content-Encoding"]/value', ns);
        if (contentEncodingValueElem)
            return contentEncodingValueElem.content.trim();
    }

    return null;
}

function createObjectMapping(mets: XmlDocument): Map<string, string> {
    const mapping = new Map<string, string>();

    for (const node of mets.find('/mets:mets/mets:fileSec/mets:fileGrp[@USE="original"]/mets:file', ns)) {
        mapping.set(
            node.get('@ID')?.content!,
            node.get('@ADMID')?.content!
        );
    }

    return mapping;
}

function getRootItem(mets: XmlDocument, directoryMetadata: Map<string, Metadata>, type: string): Item {
    const rootDir = mets.get('//mets:structMap[@TYPE="physical"]/mets:div', ns);
    if (!rootDir)
        throw new Error('Could not find the physical structmap in the METS file');

    const rootDmdId = rootDir.get('@DMDID')?.content;
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
