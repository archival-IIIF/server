const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const moment = require('moment');
const libxmljs = require('libxmljs');

const {runTask} = require('../lib/Task');
const {evictCache} = require('../lib/Cache');
const {createItem, indexItems, deleteItems} = require('../lib/Item');
const {getTypeForPronom, pronomByExtension} = require('./util/archivematica_pronom_data');

const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

const ns = {
    'mets': 'http://www.loc.gov/METS/',
    'premis': 'info:lc/xmlns/premis-v2',
    'premisv3': 'http://www.loc.gov/premis/v3',
    'mediainfo': 'https://mediaarea.net/mediainfo',
    'fits': 'http://hul.harvard.edu/ois/xml/ns/fits/fits_output',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'File': 'http://ns.exiftool.ca/File/1.0/'
};

async function processDip({dipPath}) {
    const metsFile = (await readdirAsync(dipPath)).find(file => file.startsWith('METS') && file.endsWith('xml'));
    const metsPath = path.join(dipPath, metsFile);
    const metsXml = await readFileAsync(metsPath, 'utf8');

    const mets = libxmljs.parseXml(metsXml);
    const rootLogical = mets.get('//mets:structMap[@ID="structMap_2"]/mets:div/mets:div', ns);
    const rootPhysical = mets.get('//mets:structMap[@TYPE="physical"]/mets:div/mets:div', ns);
    const rootStructureIISH = mets.get('//mets:structMap[@ID="structMap_iish"]/mets:div', ns);

    const objectsPath = path.join(dipPath, 'objects');
    const objects = await readdirAsync(objectsPath);
    const relativeRootPath = path.join(path.basename(dipPath), 'objects');

    const rootItem = getRootItem(mets);

    await cleanup(rootItem.id);

    const [childItems, texts] = walkTree({
        id: rootItem.id,
        mets,
        objects,
        relativeRootPath,
        curNode: rootLogical,
        curNodePhysical: rootPhysical,
        structureIISH: rootStructureIISH
    });

    await indexItems([rootItem, ...childItems]);

    runTask('metadata', {collectionId: rootItem.id});
    runTask('text', {collectionId: rootItem.id, items: texts});
}

function getRootItem(mets) {
    const rootDir = mets.get('//mets:structMap[@TYPE="physical"]/mets:div', ns);
    const rootDmdId = rootDir.attr('DMDID').value();
    const premisObj = mets.get(`//mets:dmdSec[@ID="${rootDmdId}"]/mets:mdWrap/mets:xmlData/premisv3:object`, ns);
    const uuid = premisObj.get('./premisv3:objectIdentifier/premisv3:objectIdentifierType[text()="UUID"]/../premisv3:objectIdentifierValue', ns).text();
    const originalName = premisObj.get('./premisv3:originalName', ns).text();
    const id = originalName.replace(`-${uuid}`, '');

    return createItem({
        'id': id,
        'collection_id': id,
        'type': id.contains('.dig') ? 'folder' : 'root', // TODO: Find a better way to separate between digital born and digitized content
        'label': id
    });
}

async function cleanup(id) {
    await Promise.all([
        deleteItems(id),
        evictCache('collection', id),
        evictCache('manifest', id)
    ]);
}

function walkTree({id, mets, objects, relativeRootPath, curNode, curNodePhysical, structureIISH, parent = null}) {
    let items = [];
    let texts = [];

    curNode.find('./mets:div', ns).forEach(node => {
        const label = node.attr('LABEL').value();
        const nodePhysical = curNodePhysical.get(`./mets:div[@LABEL="${label}"]`, ns);

        if (node.attr('TYPE').value() === 'Directory') {
            const folderInfo = readFolder(id, mets, node, nodePhysical, parent);
            if (folderInfo)
                items.push(folderInfo);

            if (folderInfo || structureIISH || (!parent && (label === 'preservation'))) {
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
            const fileInfo = readFile(id, mets, objects, relativeRootPath, node, nodePhysical, structureIISH, parent);
            if (fileInfo)
                items.push(fileInfo);
        }
        else if (structureIISH && (parent !== 'preservation')) {
            const textInfo = readText(id, mets, objects, relativeRootPath, node, nodePhysical, structureIISH, parent);
            if (textInfo)
                texts.push(textInfo);
        }
    });

    return [items, texts];
}

function readFolder(rootId, mets, node, nodePhysical, parent) {
    const dmdIdAttr = node.attr('DMDID') ? node.attr('DMDID') : nodePhysical.attr('DMDID');
    const dmdId = dmdIdAttr ? dmdIdAttr.value() : null;

    if (dmdId) {
        const premisObj = mets.get(`//mets:dmdSec[@ID="${dmdId}"]/mets:mdWrap/mets:xmlData/premisv3:object`, ns);
        const originalName = premisObj.get(`./premisv3:originalName`, ns).text();
        const name = path.basename(originalName);
        const id = getIdentifier(premisObj);

        if (id)
            return createItem({
                'id': id,
                'parent_id': parent || rootId,
                'collection_id': rootId,
                'type': 'folder',
                'label': name
            });
    }

    return null;
}

function readFile(rootId, mets, objects, relativeRootPath, node, nodePhysical, structureIISH, parent) {
    const label = nodePhysical.attr('LABEL').value();
    const fileId = nodePhysical.get('mets:fptr', ns).attr('FILEID').value();
    const internalId = fileId.substring(5);
    const premisObj = findPremisObj(mets, fileId);

    if (premisObj) {
        const originalName = premisObj.get('./premis:originalName', ns).text();
        const id = getIdentifier(premisObj);

        const objCharacteristics = premisObj.get('./premis:objectCharacteristics', ns);
        const objCharacteristicsExt = objCharacteristics.get('./premis:objectCharacteristicsExtension', ns);

        const size = parseInt(objCharacteristics.get('./premis:size', ns).text());

        const dateCreatedByApplication = objCharacteristics.get('.//premis:creatingApplication/premis:dateCreatedByApplication', ns).text();
        const creationDate = moment(dateCreatedByApplication, 'YYYY-MM-DD').toDate();

        const pronomKeyElem = objCharacteristics.get('./premis:format/premis:formatRegistry/premis:formatRegistryName[text()="PRONOM"]/../premis:formatRegistryKey', ns);
        const pronomKey = pronomKeyElem ? pronomKeyElem.text() : null;
        const name = path.basename(originalName);

        const type = getTypeForPronom(pronomKey);

        const resolution = (type === 'image' || type === 'video')
            ? determineResolution(objCharacteristicsExt)
            : {width: null, height: null};

        const file = objects.find(f => f.startsWith(internalId));
        const isOriginal = file.endsWith(label);
        const extension = path.extname(file);

        let order = null;
        if (structureIISH) {
            const pageDiv = structureIISH.get(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/..`, ns);
            order = pageDiv ? parseInt(pageDiv.attr('ORDER').value()) : null;
        }

        return createItem({
            'id': id,
            'parent_id': parent || rootId,
            'collection_id': rootId,
            'type': type,
            'label': name,
            'size': size,
            'order': order,
            'created_at': creationDate,
            'width': resolution.width,
            'height': resolution.height,
            'original': {
                'uri': isOriginal ? path.join(relativeRootPath, file) : null,
                'puid': pronomKey,
            },
            'access': {
                'uri': !isOriginal ? path.join(relativeRootPath, file) : null,
                'puid': (!isOriginal && pronomByExtension.hasOwnProperty(extension))
                    ? pronomByExtension[extension] : null
            }
        });
    }

    return null;
}

function readText(rootId, mets, objects, relativeRootPath, node, nodePhysical, structureIISH, parent) {
    const fileId = nodePhysical.get('mets:fptr', ns).attr('FILEID').value();
    const internalId = fileId.substring(5);
    const file = objects.find(f => f.startsWith(internalId));
    const premisObj = findPremisObj(mets, fileId);

    if (premisObj) {
        const id = getIdentifier(premisObj);

        const itemId = structureIISH.find(`./mets:div[@TYPE="page"]/mets:fptr[@FILEID="${fileId}"]/../mets:fptr`, ns).find(fptrElem => {
            const itemFileId = fptrElem.attr('FILEID').value();
            const itemPremisObj = findPremisObj(mets, itemFileId);
            const itemId = getIdentifier(itemPremisObj);

            const parentFolderDiv = mets.find(`//mets:structMap[@TYPE="physical"]//mets:fptr[@FILEID="${itemFileId}"]/../..`, ns);
            if (parentFolderDiv.attr('LABEL').value() === 'preservation')
                return itemId;

            return null;
        });

        let type = parent;
        let language = null;
        if (type.startsWith('translation_')) {
            type = 'translation';
            language = type.split('_')[1];
        }

        if (itemId)
            return {id, itemId, type, language, uri: path.join(relativeRootPath, file)};
    }

    return null;
}

function findPremisObj(mets, fileId) {
    const fileNode = mets.get(`mets:fileSec/mets:fileGrp[@USE="original"]/mets:file[@ID="${fileId}"]`, ns);
    const admId = fileNode ? fileNode.attr('ADMID').value() : null;

    if (admId)
        return mets.get(`//mets:amdSec[@ID="${admId}"]/mets:techMD/mets:mdWrap/mets:xmlData/premis:object`, ns);

    return null;
}

function getIdentifier(premisObj) {
    const hdlObj = premisObj.get('./premisv3:objectIdentifier/premisv3:objectIdentifierType[text()="HDL"]', ns);
    const uuidObj = premisObj.get('./premisv3:objectIdentifier/premisv3:objectIdentifierType[text()="UUID"]', ns);

    if (hdlObj) {
        const hdl = hdlObj.get('./../premisv3:objectIdentifierValue', ns).text();
        return hdl.split('/')[1];
    }

    if (uuidObj)
        return uuidObj.get('./../premisv3:objectIdentifierValue', ns).text();

    return null;
}

function determineResolution(objCharacteristicsExt) {
    const mediaInfo = objCharacteristicsExt.get('./mediainfo:MediaInfo/mediainfo:media/mediainfo:track[@type="Image" or @type="Video"]', ns);
    if (mediaInfo) {
        const resolution = getResolution(
            mediaInfo.get('./mediainfo:Width', ns).text(),
            mediaInfo.get('./mediainfo:Height', ns).text()
        );
        if (resolution) return resolution;
    }

    const ffprobe = objCharacteristicsExt.get('./ffprobe/streams/stream[@codec_type="video"]', ns);
    if (ffprobe) {
        const resolution = getResolution(ffprobe.attr('width').value(), ffprobe.attr('height').value());
        if (resolution) return resolution;
    }

    const exifTool = objCharacteristicsExt.get('./rdf:RDF/rdf:Description', ns);
    if (exifTool) {
        const resolution = getResolution(
            exifTool.get('./File:ImageWidth', ns).text(),
            exifTool.get('./File:ImageHeight', ns).text()
        );
        if (resolution) return resolution;
    }

    const fitsExifTool = objCharacteristicsExt.get('./fits:fits/fits:toolOutput/fits:tool[@name="Exiftool"]/exiftool', ns);
    if (fitsExifTool) {
        const resolution = getResolution(
            fitsExifTool.get('./ImageWidth', ns).text(),
            fitsExifTool.get('./ImageHeight', ns).text()
        );
        if (resolution) return resolution;
    }

    return {width: null, height: null};
}

function getResolution(width, height) {
    if (width && height) {
        return {
            width: Number.parseInt(width),
            height: Number.parseInt(height)
        };
    }
    return null;
}

module.exports = processDip;
