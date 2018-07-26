const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const libxmljs = require('libxmljs');
const pg = require('pg-promise')();

const db = require('../lib/DB');
const {evictCache} = require('../lib/Cache');
const {getTypeForPronom, pronomByExtension} = require('./util/archivematica_pronom_data');

const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

const namespaces = {
    'mets': 'http://www.loc.gov/METS/',
    'premis': 'info:lc/xmlns/premis-v2',
    'premisv3': 'http://www.loc.gov/premis/v3',
};

const columnSet = new pg.helpers.ColumnSet([
    "id",
    "parent_id",
    "container_id",
    "metadata",
    "type",
    "label",
    "original_resolver",
    "original_pronom",
    "access_resolver",
    "access_pronom"
]);

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
        "id": id,
        "parent_id": null,
        "container_id": id,
        "metadata": null,
        "type": 'folder',
        "label": id,
        "original_resolver": null,
        "original_pronom": null,
        "access_resolver": null,
        "access_pronom": null
    }];

    items = items.concat(walkTree({
        id, mets, objects, relativeRootPath, curNode: rootLogical, curNodePhysical: rootPhysical
    }));

    await writeItems(items);
}

async function cleanup(id) {
    const result = await db.result("SELECT id FROM manifest WHERE container_id = $1", [id]);
    if (result.rowCount > 0) {
        await db.none("DELETE FROM manifest WHERE container_id = $1;", [id]);

        await evictCache('collection', id);
        await evictCache('manifest', id);
    }
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
            "id": id,
            "parent_id": parent || rootId,
            "container_id": rootId,
            "metadata": null,
            "type": 'folder',
            "label": name,
            "original_resolver": null,
            "original_pronom": null,
            "access_resolver": null,
            "access_pronom": null
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
        const creationDate = objCharacteristics.get('.//premis:creatingApplication/premis:dateCreatedByApplication', namespaces).text();
        const size = objCharacteristics.get('./premis:size', namespaces).text();
        const pronomKeyElem = objCharacteristics.get('./premis:format/premis:formatRegistry/premis:formatRegistryName[text()="PRONOM"]/../premis:formatRegistryKey', namespaces);
        const pronomKey = pronomKeyElem ? pronomKeyElem.text() : null;
        const name = path.basename(originalName);

        const file = objects.find(f => f.startsWith(id));
        const isOriginal = file.endsWith(label);
        const extension = path.extname(file);

        return {
            "id": id,
            "parent_id": parent || rootId,
            "container_id": rootId,
            "metadata": {'Creation date': creationDate, 'Size': size},
            "type": getTypeForPronom(pronomKey),
            "label": name,
            "original_resolver": isOriginal ? path.join(relativeRootPath, file) : null,
            "original_pronom": pronomKey,
            "access_resolver": !isOriginal ? path.join(relativeRootPath, file) : null,
            "access_pronom": (!isOriginal && pronomByExtension.hasOwnProperty(extension))
                ? pronomByExtension[extension] : null
        };
    }

    return null;
}

async function writeItems(items) {
    const sql = pg.helpers.insert(items, columnSet, 'manifest');
    await db.none(sql, items);
}

module.exports = processDip;
