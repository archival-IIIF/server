const fs = require('fs');
const {promisify} = require('util');
const libxmljs = require('libxmljs');

const client = require('../lib/ElasticSearch');

const readFileAsync = promisify(fs.readFile);

function createText(obj) {
    return {
        id: null,
        item_id: null,
        collection_id: null,
        type: null,
        language: null,
        encoding: null,
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
            x: stringElem.attr('VPOS').value(),
            y: stringElem.attr('HPOS').value(),
            width: stringElem.attr('WIDTH').value(),
            height: stringElem.attr('HEIGHT').value(),
            word: stringElem.attr('CONTENT').value()
        };
    });
}

module.exports = {
    createText,
    indexTexts,
    deleteTexts,
    readAlto
};
