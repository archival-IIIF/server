const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const detectCharacterEncoding = require('detect-character-encoding');

const {createText, indexTexts, deleteTexts, readAlto} = require('../lib/Text');

const readFileAsync = promisify(fs.readFile);

async function processText({collectionId, items}) {
    await deleteTexts(collectionId);

    const textItems = await Promise.all(items.map(async item => {
        const [text, encoding] = await getTextFromFile(item.uri);
        return createText({
            id: item.id,
            item_id: item.itemId,
            collection_id: collectionId,
            type: item.type,
            language: item.language,
            encoding,
            text
        });
    }));

    await indexTexts(textItems);
}

async function getTextFromFile(uri) {
    const extension = path.extname(uri);
    switch (extension) {
        case 'xml':
            return await getAltoText(uri);
        case 'txt':
        default:
            return await getPlainText(uri);
    }
}

async function getPlainText(uri) {
    const textBuffer = await readFileAsync(uri);
    const encoding = detectCharacterEncoding(textBuffer)[0].encoding;
    const text = await readFileAsync(uri, encoding);

    return [text, encoding];
}

async function getAltoText(uri) {
    const altoWords = await readAlto(uri);
    const text = altoWords.map(altoWord => altoWord.word).join(' ');

    return [text, 'utf-8'];
}

module.exports = processText;
