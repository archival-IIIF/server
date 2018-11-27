const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const libxmljs = require('libxmljs');

const config = require('../lib/Config');
const client = require('../lib/ElasticSearch');

const readFileAsync = promisify(fs.readFile);

function createText(obj) {
    return {
        id: null,
        item_id: null,
        collection_id: null,
        type: null,
        language: null,
        uri: null,
        text: null,
        ...obj
    };
}

async function indexTexts(textItems) {
    while (textItems.length > 0) {
        const body = [].concat(...textItems.splice(0, 100).map(item => [
            {index: {_index: 'texts', _type: '_doc', _id: item.id}},
            item
        ]));
        const result = await client.bulk({body});
        if (result.errors)
            throw new Error('Failed to index the text items');
    }
}

async function deleteTexts(collectionId) {
    await client.deleteByQuery({index: 'texts', q: `collection_id:${collectionId}`});
}

async function readAlto(uri) {
    const altoXml = await readFileAsync(uri, 'utf8');
    const alto = libxmljs.parseXml(altoXml);
    return alto.find('String', {}).map(stringElem => {
        return {
            x: parseInt(stringElem.attr('VPOS').value()),
            y: parseInt(stringElem.attr('HPOS').value()),
            width: parseInt(stringElem.attr('WIDTH').value()),
            height: parseInt(stringElem.attr('HEIGHT').value()),
            word: stringElem.attr('CONTENT').value()
        };
    });
}

async function getTextsByItemId(id) {
    try {
        const response = await client.get({index: 'texts', type: '_doc', id: id});
        return response._source;
    }
    catch (err) {
        return null;
    }
}

function getFullPath(item) {
    return item.uri ? path.join(config.dataPath, item.uri) : null;
}

module.exports = {
    createText,
    indexTexts,
    deleteTexts,
    readAlto,
    getFullPath
};
