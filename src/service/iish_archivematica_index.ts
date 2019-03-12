import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as moment from 'moment';
import * as libxmljs from 'libxmljs';
import {Attribute, Document, Element} from 'libxmljs';

import config from '../lib/Config';
import {runTask} from '../lib/Task';
import {evictCache} from '../lib/Cache';
import {createItem, indexItems, deleteItems} from '../lib/Item';
import {IndexParams, MetadataParams, TextParams} from '../lib/Service';
import {MinimalItem, FileItem, FolderItem, Item} from '../lib/ItemInterfaces';

import {TextItem} from './util/types';
import {getTypeForPronom, pronomByExtension} from './util/archivematica_pronom_data';

type WalkTreeParams = {
    id: string;
    mets: Document;
    objects: string[];
    relativeRootPath: string;
    curNode: Element;
    curNodePhysical: Element;
    structureIISH: Element | null;
    parent?: string | null;
};

type CollectionProcessingResult = {
    rootItem: Item,
    childItems: Item[],
    textItems: TextItem[]
}

const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

const ns = {
    'mets': 'http://www.loc.gov/METS/',
    'premis': 'info:lc/xmlns/premis-v2',
    'premisv3': 'http://www.loc.gov/premis/v3',
    'mediainfo': 'https://mediaarea.net/mediainfo',
    'fits': 'http://hul.harvard.edu/ois/xml/ns/fits/fits_output',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'IFD0': 'http://ns.exiftool.ca/EXIF/IFD0/1.0/',
    'File': 'http://ns.exiftool.ca/File/1.0/'
};

export default async function processDip({collectionPath}: IndexParams): Promise<void> {
    try {
        const {rootItem, childItems, textItems} = await processCollection(collectionPath);

        await cleanup(rootItem.id);
        await indexItems([rootItem, ...childItems]);

        runTask<MetadataParams>('metadata', {collectionId: rootItem.id});
        runTask<TextParams>('text', {collectionId: rootItem.id, items: textItems});
    }
    catch (e) {
        throw new Error(`Failed to index the collection ${collectionPath}: ${e.message}`);
    }
}

export async function processCollection(collectionPath: string): Promise<CollectionProcessingResult> {
    const metsFile = (await readdirAsync(collectionPath)).find(file => file.startsWith('METS') && file.endsWith('xml'));
    if (!metsFile)
        throw new Error(`No METS file found in the collection ${collectionPath}`);

    const metsPath = path.join(collectionPath, metsFile);
    const metsXml = await readFileAsync(metsPath, 'utf8');

    const mets = libxmljs.parseXml(metsXml);
    const rootLogical = mets.get('//mets:structMap[@ID="structMap_2"]/mets:div/mets:div', ns);
    const rootPhysical = mets.get('//mets:structMap[@TYPE="physical"]/mets:div/mets:div', ns);
    const rootStructureIISH = mets.get('//mets:structMap[@ID="structMap_iish"]/mets:div', ns);
    if (!rootPhysical)
        throw new Error('Could not find the physical structmap in the METS file');

    const objectsPath = path.join(collectionPath, 'objects');
    const objects = fs.existsSync(objectsPath) ? await readdirAsync(objectsPath) : [];
    const relativeRootPath = objectsPath.replace(`${config.dataPath}/`, '');

    const rootItem = getRootItem(mets, rootStructureIISH);
    const [childItems, textItems] = walkTree({
        id: rootItem.id,
        mets,
        objects,
        relativeRootPath,
        curNode: rootLogical || rootPhysical,
        curNodePhysical: rootPhysical,
        structureIISH: rootStructureIISH
    });

    return {rootItem, childItems, textItems};
}

async function cleanup(id: string): Promise<void> {
    await Promise.all([
        deleteItems(id),
        evictCache('collection', id),
        evictCache('manifest', id)
    ]);
}

function getRootItem(mets: Document, structureIISH: Element | null): Item {
    const rootDir = mets.get('//mets:structMap[@TYPE="physical"]/mets:div', ns);
    if (!rootDir)
        throw new Error('Could not find the physical structmap in the METS file');

    const rootDmdIdAttr = rootDir.attr('DMDID');
    const rootDmdId = rootDmdIdAttr ? rootDmdIdAttr.value() : null;
    const premisObj = mets.get(`//mets:dmdSec[@ID="${rootDmdId}"]/mets:mdWrap/mets:xmlData/premisv3:object`, ns);
    if (!premisObj)
        throw new Error('Could not find the premis object of the root item in the METS file');

    const uuidElem = premisObj.get('./premisv3:objectIdentifier/premisv3:objectIdentifierType[text()="UUID"]/../premisv3:objectIdentifierValue', ns);
    const originalNameElem = premisObj.get('./premisv3:originalName', ns);
    if (!uuidElem || !originalNameElem)
        throw new Error('Could not find the UUID and/or original name of the root item in the METS file');

    const id = originalNameElem.text().replace(`-${uuidElem.text()}`, '');

    return createItem({
        'id': id,
        'collection_id': id,
        'type': structureIISH ? 'root' : 'folder',
        'label': id
    } as MinimalItem);
}

function walkTree({id, mets, objects, relativeRootPath, curNode, curNodePhysical, structureIISH, parent = null}:
                      WalkTreeParams): [Item[], TextItem[]] {
    let items: Item[] = [];
    let texts: TextItem[] = [];

    (curNode.find('./mets:div', ns) as Element[]).forEach(node => {
        const labelAttr = node.attr('LABEL');
        const label = labelAttr ? labelAttr.value() : null;
        if (!label)
            throw new Error('Expected to find a label for an element in the structmap');

        const nodePhysical = curNodePhysical.get(`./mets:div[@LABEL="${label}"]`, ns) || curNodePhysical;
        const typeAttr = node.attr('TYPE');
        if (typeAttr && typeAttr.value() === 'Directory') {
            const folderInfo = !structureIISH ? readFolder(id, label, mets, node, nodePhysical, parent) : null;
            if (folderInfo)
                items.push(folderInfo);

            if (folderInfo || (structureIISH && !parent)) {
                const [childItems, childTexts] = walkTree({
                    id,
                    mets,
                    objects,
                    relativeRootPath,
                    curNode: node,
                    curNodePhysical: nodePhysical,
                    structureIISH,
                    parent: folderInfo ? folderInfo.id : label
                });

                items = items.concat(childItems);
                texts = texts.concat(childTexts);
            }
        }
        else if (!structureIISH || (parent === 'preservation')) {
            const fileInfo = readFile(id, label, mets, objects, relativeRootPath, nodePhysical, structureIISH, parent);
            items.push(fileInfo);
        }
        else if (structureIISH && parent && (parent === 'transcription' || parent.startsWith('translation_'))) {
            const textInfo = readText(id, label, mets, objects, relativeRootPath, nodePhysical, structureIISH, parent);
            texts.push(textInfo);
        }
    });

    return [items, texts];
}

function readFolder(rootId: string, label: string, mets: Document, node: Element,
                    nodePhysical: Element, parent: string | null): Item | null {
    const dmdIdAttr = node.attr('DMDID') ? node.attr('DMDID') : nodePhysical.attr('DMDID');
    const dmdId = dmdIdAttr ? dmdIdAttr.value() : null;

    if (dmdId) {
        const premisObj = mets.get(`//mets:dmdSec[@ID="${dmdId}"]/mets:mdWrap/mets:xmlData/premisv3:object`, ns);
        if (!premisObj)
            throw new Error(`No premis object found for DMD id ${dmdId}`);

        const originalNameElem = premisObj.get(`./premisv3:originalName`, ns);
        if (!originalNameElem)
            throw new Error(`No original name found for object with DMD id ${dmdId}`);

        const originalName = originalNameElem.text();
        const name = path.basename(originalName);
        const id = getIdentifier(premisObj, 'premisv3');
        if (!id)
            throw new Error(`No identifier found for object with DMD id ${dmdId}`);

        return createItem({
            'id': id,
            'parent_id': parent || rootId,
            'collection_id': rootId,
            'type': 'folder',
            'label': name
        } as FolderItem);
    }

    return null;
}

function readFile(rootId: string, label: string, mets: Document, objects: string[], relativeRootPath: string,
                  node: Element, structureIISH: Element | null, parent: string | null): Item {
    const fptrElem = node.get('mets:fptr', ns);
    if (!fptrElem || !fptrElem.attr('FILEID'))
        throw new Error(`Missing a fptr or file id for a file with the label ${label}`);

    const fileId = (fptrElem.attr('FILEID') as Attribute).value();
    const internalId = fileId.substring(5);
    const premisObj = findPremisObj(mets, fileId);
    if (!premisObj)
        throw new Error(`No premis object found for a file with the label ${label}`);

    const originalNameElem = premisObj.get(`./premis:originalName`, ns);
    if (!originalNameElem)
        throw new Error(`No original name found for object with file id ${fileId}`);

    const originalName = originalNameElem.text();
    const id = getIdentifier(premisObj, 'premis');
    if (!id)
        throw new Error(`No identifier found for object with file id ${fileId}`);

    const objCharacteristics = premisObj.get('./premis:objectCharacteristics', ns);
    const objCharacteristicsExt = objCharacteristics
        ? objCharacteristics.get('./premis:objectCharacteristicsExtension', ns) : null;
    if (!objCharacteristics || !objCharacteristicsExt)
        throw new Error(`No object characteristics found for object with file id ${fileId}`);

    const sizeElem = objCharacteristics.get('./premis:size', ns);
    const size = sizeElem ? parseInt(sizeElem.text()) : null;

    const dateCreatedByAppElem = objCharacteristics.get('.//premis:creatingApplication/premis:dateCreatedByApplication', ns);
    const creationDate = dateCreatedByAppElem
        ? moment(dateCreatedByAppElem.text(), 'YYYY-MM-DD').toDate() : null;

    const pronomKeyElem = objCharacteristics.get('./premis:format/premis:formatRegistry/premis:formatRegistryName[text()="PRONOM"]/../premis:formatRegistryKey', ns);
    const pronomKey = pronomKeyElem ? pronomKeyElem.text() : null;
    const name = path.basename(originalName);
    const type = getTypeForPronom(pronomKey);

    const resolution = (type === 'image' || type === 'video')
        ? determineResolution(objCharacteristicsExt)
        : {width: null, height: null};
    const dpi = (type === 'image') ? determineDpi(objCharacteristicsExt) : null;
    const duration = (type === 'video' || type === 'audio') ? determineDuration(objCharacteristicsExt) : null;

    const file = objects.find(f => f.startsWith(internalId));
    if (!file)
        throw new Error(`Expected to find a file starting with ${internalId}`);

    const isOriginal = file.endsWith(label);
    const extension = path.extname(file);

    let order = null;
    if (structureIISH) {
        const pageDiv = structureIISH.get(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/..`, ns);
        const orderAttr = pageDiv ? pageDiv.attr('ORDER') : null;
        order = orderAttr ? parseInt(orderAttr.value()) : null;
    }

    return createItem({
        'id': id,
        'parent_id': (parent && (parent !== 'preservation')) ? parent : rootId,
        'collection_id': rootId,
        'type': type,
        'label': name,
        'size': size,
        'order': order,
        'created_at': creationDate,
        'width': resolution.width,
        'height': resolution.height,
        'resolution': dpi,
        'duration': duration,
        'original': {
            'uri': isOriginal ? path.join(relativeRootPath, file) : null,
            'puid': pronomKey,
        },
        'access': {
            'uri': !isOriginal ? path.join(relativeRootPath, file) : null,
            'puid': (!isOriginal && pronomByExtension.hasOwnProperty(extension))
                ? pronomByExtension[extension] : null
        }
    } as FileItem);
}

function readText(rootId: string, label: string, mets: Document, objects: string[], relativeRootPath: string,
                  node: Element, structureIISH: Element, parent: string): TextItem {
    const fptrElem = node.get('mets:fptr', ns);
    if (!fptrElem || !fptrElem.attr('FILEID'))
        throw new Error(`Missing a fptr or file id for a file with the label ${label}`);

    const fileId = (fptrElem.attr('FILEID') as Attribute).value();
    const internalId = fileId.substring(5);
    const file = objects.find(f => f.startsWith(internalId));
    if (!file)
        throw new Error(`Expected to find a file starting with ${internalId}`);

    const premisObj = findPremisObj(mets, fileId);
    if (!premisObj)
        throw new Error(`No premis object found for a file with the label ${label}`);

    const id = getIdentifier(premisObj, 'premis');
    if (!id)
        throw new Error(`No identifier found for object with file id ${fileId}`);

    const fptrs = (structureIISH.find(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/../mets:fptr`, ns) as Element[]);
    const fptr = fptrs.find(fptrElem => {
        const fileIdAttr = fptrElem.attr('FILEID');
        const itemFileId = fileIdAttr ? fileIdAttr.value() : null;
        const parentFolderDiv = mets.get(`//mets:structMap[@TYPE="physical"]//mets:fptr[@FILEID="${itemFileId}"]/../..`, ns);
        if (parentFolderDiv) {
            const labelAttr = parentFolderDiv.attr('LABEL');
            return (labelAttr !== null && labelAttr.value() === 'preservation');
        }
        return false;
    });

    if (!fptr || !fptr.attr('FILEID'))
        throw new Error(`Missing a fptr or file id for a file for the text layer with label ${label}`);

    const itemFileId = (fptr.attr('FILEID') as Attribute).value();
    const itemPremisObj = findPremisObj(mets, itemFileId);
    if (!itemPremisObj)
        throw new Error(`No premis object found for file with id ${itemFileId}`);

    const itemId = getIdentifier(itemPremisObj, 'premis');
    if (!itemId)
        throw new Error(`Missing a file id for a file with id ${itemFileId}`);

    let type = parent;
    let language = null;
    if (type.startsWith('translation_')) {
        type = 'translation';
        language = type.split('_')[1];
    }

    return {id, itemId, type, language, uri: path.join(relativeRootPath, file)};
}

function findPremisObj(mets: Document, fileId: string): Element | null {
    const fileNode = mets.get(`mets:fileSec/mets:fileGrp[@USE="original"]/mets:file[@ID="${fileId}"]`, ns);
    const admIdAttr = fileNode ? fileNode.attr('ADMID') : null;
    const admId = admIdAttr ? admIdAttr.value() : null;

    if (admId)
        return mets.get(`//mets:amdSec[@ID="${admId}"]/mets:techMD/mets:mdWrap/mets:xmlData/premis:object`, ns);

    return null;
}

export function getIdentifier(premisObj: Element, premisNS: 'premis' | 'premisv3' = 'premis'): string | null {
    const hdlObj = premisObj.get(`./${premisNS}:objectIdentifier/${premisNS}:objectIdentifierType[text()="hdl"]`, ns);
    const uuidObj = premisObj.get(`./${premisNS}:objectIdentifier/${premisNS}:objectIdentifierType[text()="UUID"]`, ns);

    if (hdlObj) {
        const objIdAttr = hdlObj.get(`./../${premisNS}:objectIdentifierValue`, ns);
        if (objIdAttr) {
            const hdl = objIdAttr.text();
            return hdl.split('/')[1];
        }
    }

    if (uuidObj) {
        const objIdAttr = uuidObj.get(`./../${premisNS}:objectIdentifierValue`, ns);
        if (objIdAttr)
            return objIdAttr.text();
    }

    return null;
}

export function determineResolution(objCharacteristicsExt: Element): { width: number | null; height: number | null } {
    const mediaInfo = objCharacteristicsExt.get('./mediainfo:MediaInfo/mediainfo:media/mediainfo:track[@type="Image" or @type="Video"]', ns);
    if (mediaInfo) {
        const widthElem = mediaInfo.get('./mediainfo:Width', ns);
        const heightElem = mediaInfo.get('./mediainfo:Height', ns);

        if (widthElem && heightElem) {
            const resolution = getResolution(widthElem.text(), heightElem.text());
            if (resolution) return resolution;
        }
    }

    const ffprobe = objCharacteristicsExt.get('./ffprobe/streams/stream[@codec_type="video"]', ns);
    if (ffprobe) {
        const widthAttr = ffprobe.attr('width');
        const heightAttr = ffprobe.attr('height');

        if (widthAttr && heightAttr) {
            const resolution = getResolution(widthAttr.value(), heightAttr.value());
            if (resolution) return resolution;
        }
    }

    const exifTool = objCharacteristicsExt.get('./rdf:RDF/rdf:Description', ns);
    if (exifTool) {
        const widthElem = exifTool.get('./File:ImageWidth', ns);
        const heightElem = exifTool.get('./File:ImageHeight', ns);

        if (widthElem && heightElem) {
            const resolution = getResolution(widthElem.text(), heightElem.text());
            if (resolution) return resolution;
        }
    }

    const fitsExifTool = objCharacteristicsExt.get('./fits:fits/fits:toolOutput/fits:tool[@name="Exiftool"]/exiftool', ns);
    if (fitsExifTool) {
        const widthElem = fitsExifTool.get('./ImageWidth', ns);
        const heightElem = fitsExifTool.get('./ImageHeight', ns);

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
    const exifTool = objCharacteristicsExt.get('./rdf:RDF/rdf:Description', ns);
    if (exifTool) {
        const resolutionElem = exifTool.get('./IFD0:XResolution', ns);

        if (resolutionElem) {
            const dpi = Number.parseInt(resolutionElem.text());
            if (dpi) return dpi;
        }
    }

    const fitsExifTool = objCharacteristicsExt.get('./fits:fits/fits:toolOutput/fits:tool[@name="Exiftool"]/exiftool', ns);
    if (fitsExifTool) {
        const resolutionElem = fitsExifTool.get('./XResolution', ns);

        if (resolutionElem) {
            const dpi = Number.parseInt(resolutionElem.text());
            if (dpi) return dpi;
        }
    }

    return null;
}

export function determineDuration(objCharacteristicsExt: Element): number | null {
    const mediaInfo = objCharacteristicsExt.get('./mediainfo:MediaInfo/mediainfo:media/mediainfo:track[@type="General"]', ns);
    if (mediaInfo) {
        const durationElem = mediaInfo.get('./mediainfo:Duration', ns);

        if (durationElem) {
            const duration = Number.parseFloat(durationElem.text());
            if (duration) return duration;
        }
    }

    let duration: number | null = null;
    (objCharacteristicsExt.find('./ffprobe/streams/stream', ns) as Element[]).forEach(stream => {
        const durationAttr = stream.attr('duration');
        const curDuration = durationAttr ? Number.parseFloat(durationAttr.value()) : null;
        if (curDuration && (duration === null || curDuration > duration))
            duration = curDuration;
    });
    if (duration) return duration;

    return null;
}
