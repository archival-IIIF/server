const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const moment = require('moment');
const libxmljs = require('libxmljs');

const {indexItems, deleteItems} = require('../lib/Item');
const {evictCache} = require('../lib/Cache');
const {getTypeForPronom, pronomByExtension} = require('./util/archivematica_pronom_data');

const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

const namespaces = {
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
    const rootLogical = mets.get('//mets:structMap[@TYPE="logical"]/mets:div/mets:div', namespaces);
    const rootPhysical = mets.get('//mets:structMap[@TYPE="physical"]/mets:div/mets:div', namespaces);

    const rootDir = mets.get('//mets:structMap[@TYPE="physical"]/mets:div', namespaces);
    const rootDmdId = rootDir.attr('DMDID').value();
    const premisObj = mets.get(`//mets:dmdSec[@ID="${rootDmdId}"]/mets:mdWrap/mets:xmlData/premisv3:object`, namespaces);
    const uuid = premisObj.get('./premisv3:objectIdentifier/premisv3:objectIdentifierType[text()="UUID"]/../premisv3:objectIdentifierValue', namespaces).text();
    const originalName = premisObj.get('./premisv3:originalName', namespaces).text();
    const id = originalName.replace(`-${uuid}`, '');

    const objectsPath = path.join(dipPath, 'objects');
    const objects = await readdirAsync(objectsPath);

    const relativeRootPath = path.join(path.basename(dipPath), 'objects');

    await cleanup(id);

    let items = [{
        'id': id,
        'parent_id': null,
        'collection_id': id,
        'type': 'folder',
        'label': id,
        'size': null,
        'created_at': null,
        'width': null,
        'height': null,
        'metadata': null,
        'original': {
            'uri': null,
            'puid': null
        },
        'access': {
            'uri': null,
            'puid': null
        }
    }];

    items = items.concat(walkTree({
        id, mets, objects, relativeRootPath, curNode: rootLogical, curNodePhysical: rootPhysical
    }));

    await indexItems(items);
}

async function cleanup(id) {
    await deleteItems(id);
    await evictCache('collection', id);
    await evictCache('manifest', id);
}

function walkTree({id, mets, objects, relativeRootPath, curNode, curNodePhysical, parent = null}) {
    let items = [];

    curNode.find('./mets:div', namespaces).forEach(node => {
        const nodePhysical = curNodePhysical.get(`./mets:div[@LABEL="${node.attr('LABEL').value()}"]`, namespaces);

        if (node.attr('TYPE').value() === 'Directory') {
            const folderInfo = readFolder(id, mets, node, nodePhysical, parent);
            if (folderInfo) {
                items.push(folderInfo);
                items = items.concat(walkTree({
                    id,
                    mets,
                    objects,
                    relativeRootPath,
                    curNode: node,
                    curNodePhysical: nodePhysical,
                    parent: folderInfo.id
                }));
            }
        }
        else {
            const fileInfo = readFile(id, mets, objects, relativeRootPath, node, nodePhysical, parent);
            if (fileInfo)
                items.push(fileInfo);
        }
    });

    return items;
}

function readFolder(rootId, mets, node, nodePhysical, parent) {
    const dmdIdAtrr = node.attr('DMDID') ? node.attr('DMDID') : nodePhysical.attr('DMDID');
    const dmdId = dmdIdAtrr ? dmdIdAtrr.value() : null;

    if (dmdId) {
        const premisObj = mets.get(`//mets:dmdSec[@ID="${dmdId}"]/mets:mdWrap/mets:xmlData/premisv3:object`, namespaces);
        const originalName = premisObj.get(`./premisv3:originalName`, namespaces).text();
        const id = premisObj.get(`./premisv3:objectIdentifier/premisv3:objectIdentifierType[text()="UUID"]/../premisv3:objectIdentifierValue`, namespaces).text();
        const name = path.basename(originalName);

        return {
            'id': id,
            'parent_id': parent || rootId,
            'collection_id': rootId,
            'type': 'folder',
            'label': name,
            'size': null,
            'created_at': null,
            'width': null,
            'height': null,
            'metadata': null,
            'original': {
                'uri': null,
                'puid': null
            },
            'access': {
                'uri': null,
                'puid': null
            }
        };
    }

    return null;
}

function readFile(rootId, mets, objects, relativeRootPath, node, nodePhysical, parent) {
    const label = nodePhysical.attr('LABEL').value();
    const fileId = nodePhysical.get('mets:fptr', namespaces).attr('FILEID').value();
    const fileNode = mets.get(`mets:fileSec/mets:fileGrp[@USE="original"]/mets:file[@ID="${fileId}"]`, namespaces);
    const admId = fileNode ? fileNode.attr('ADMID').value() : null;

    if (admId) {
        const premisObj = mets.get(`//mets:amdSec[@ID="${admId}"]/mets:techMD/mets:mdWrap/mets:xmlData/premis:object`, namespaces);
        const originalName = premisObj.get('./premis:originalName', namespaces).text();
        const id = premisObj.get('./premis:objectIdentifier/premis:objectIdentifierType[text()="UUID"]/../premis:objectIdentifierValue', namespaces).text();

        const objCharacteristics = premisObj.get('./premis:objectCharacteristics', namespaces);
        const objCharacteristicsExt = objCharacteristics.get('./premis:objectCharacteristicsExtension', namespaces);

        const size = Number.parseInt(objCharacteristics.get('./premis:size', namespaces).text());

        const dateCreatedByApplication = objCharacteristics.get('.//premis:creatingApplication/premis:dateCreatedByApplication', namespaces).text();
        const creationDate = moment(dateCreatedByApplication, 'YYYY-MM-DD').toDate();

        const pronomKeyElem = objCharacteristics.get('./premis:format/premis:formatRegistry/premis:formatRegistryName[text()="PRONOM"]/../premis:formatRegistryKey', namespaces);
        const pronomKey = pronomKeyElem ? pronomKeyElem.text() : null;
        const name = path.basename(originalName);

        const type = getTypeForPronom(pronomKey);

        const resolution = (type === 'image' || type === 'video')
            ? determineResolution(objCharacteristicsExt)
            : {width: null, height: null};

        const file = objects.find(f => f.startsWith(id));
        const isOriginal = file.endsWith(label);
        const extension = path.extname(file);

        return {
            'id': id,
            'parent_id': parent || rootId,
            'collection_id': rootId,
            'type': type,
            'label': name,
            'size': size,
            'created_at': creationDate,
            'width': resolution.width,
            'height': resolution.height,
            'metadata': null,
            'original': {
                'uri': isOriginal ? path.join(relativeRootPath, file) : null,
                'puid': pronomKey,
            },
            'access': {
                'uri': !isOriginal ? path.join(relativeRootPath, file) : null,
                'puid': (!isOriginal && pronomByExtension.hasOwnProperty(extension))
                    ? pronomByExtension[extension] : null
            }
        };
    }

    return null;
}

function determineResolution(objCharacteristicsExt) {
    const mediaInfo = objCharacteristicsExt.get('./mediainfo:MediaInfo/mediainfo:media/mediainfo:track[@type="Image" or @type="Video"]', namespaces);
    if (mediaInfo) {
        const resolution = getResolution(
            mediaInfo.get('./mediainfo:Width', namespaces).text(),
            mediaInfo.get('./mediainfo:Height', namespaces).text()
        );
        if (resolution) return resolution;
    }

    const ffprobe = objCharacteristicsExt.get('./ffprobe/streams/stream[@codec_type="video"]', namespaces);
    if (ffprobe) {
        const resolution = getResolution(ffprobe.attr('width'), ffprobe.attr('height'));
        if (resolution) return resolution;
    }

    const exifTool = objCharacteristicsExt.get('./rdf:RDF/rdf:Description', namespaces);
    if (exifTool) {
        const resolution = getResolution(
            exifTool.get('./File:ImageWidth', namespaces).text(),
            exifTool.get('./File:ImageHeight', namespaces).text()
        );
        if (resolution) return resolution;
    }

    const fitsExifTool = objCharacteristicsExt.get('./fits:fits/fits:toolOutput/fits:tool[@name="Exiftool"]/exiftool', namespaces);
    if (fitsExifTool) {
        const resolution = getResolution(
            fitsExifTool.get('./ImageWidth', namespaces).text(),
            fitsExifTool.get('./ImageHeight', namespaces).text()
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
