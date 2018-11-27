const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

const {createText, indexTexts, deleteTexts, readAlto, getFullPath} = require('../lib/Text');

const readFileAsync = promisify(fs.readFile);

async function processText({collectionId, items}) {
    await deleteTexts(collectionId);

    const textItems = await Promise.all(items.map(async item => {
        const text = await getTextFromFile(item);
        return createText({
            id: item.id,
            item_id: item.itemId,
            collection_id: collectionId,
            type: item.type,
            language: item.language,
            uri: item.uri,
            text
        });
    }));

    await indexTexts(textItems);
}

async function getTextFromFile(item) {
    const extension = path.extname(item.uri);
    switch (extension) {
        case 'xml':
            return await getAltoText(item);
        case 'txt':
        default:
            return await getPlainText(item);
    }
}

async function getPlainText(item) {
    const textBuffer = await readFileAsync(getFullPath(item));
    const encodingDetection = jschardet.detect(textBuffer);
    return iconv.decode(textBuffer, encodingDetection.encoding);
}

async function getAltoText(item) {
    const altoWords = await readAlto(getFullPath(item));
    return altoWords.map(altoWord => altoWord.word).join(' ');
}

module.exports = processText;
