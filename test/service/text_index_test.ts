import {join} from 'node:path';
import {expect} from 'chai';

import {getText, getTextStructure} from '../../src/service/text_index.js';

const testRootDirectory = './test/service';

describe('text_index', () => {
    describe('#getTextStructure()', () => {
        it('should correctly obtain the structure from an ALTO XML file', async () => {
            const structure = await getTextStructure(join(testRootDirectory, 'test-text/alto.xml'));

            expect(structure).to.deep.equal({
                blocks: [{
                    lines: [{
                        words: [
                            {idx: 0, x: 1557, y: 318, width: 47, height: 4, isHyphenated: false, content: 'The'},
                            {idx: 1, x: 1654, y: 297, width: 23, height: 37, isHyphenated: false, content: 'first'},
                            {idx: 2, x: 1726, y: 319, width: 49, height: 3, isHyphenated: false, content: 'block.'}
                        ]
                    }]
                }, {
                    lines: [{
                        words: [
                            {idx: 3, x: 354, y: 394, width: 33, height: 35, isHyphenated: false, content: 'This'},
                            {idx: 4, x: 408, y: 396, width: 236, height: 43, isHyphenated: false, content: 'is'},
                            {idx: 5, x: 660, y: 396, width: 44, height: 35, isHyphenated: false, content: 'one'},
                            {idx: 6, x: 730, y: 405, width: 56, height: 27, isHyphenated: false, content: 'line'},
                            {idx: 7, x: 815, y: 398, width: 173, height: 40, isHyphenated: false, content: 'of'},
                            {idx: 8, x: 1015, y: 399, width: 28, height: 34, isHyphenated: false, content: 'text.'}
                        ]
                    }]
                }]
            });
        });

        it('should not obtain the structure from a plain text file', async () => {
            const structure = await getTextStructure(join(testRootDirectory, 'test-text/utf8.txt'));

            expect(structure).to.be.null;
        });
    });

    describe('#getText()', () => {
        it('should correctly obtain the text from an ALTO XML file', async () => {
            const structure = await getTextStructure(join(testRootDirectory, 'test-text/alto.xml'));
            const text = await getText(join(testRootDirectory, 'test-text/alto.xml'), 'utf8', structure);

            expect(text).to.equal('The first block.\nThis is one line of text.');
        });

        it('should correctly obtain the text from an UTF-8 encoded file', async () => {
            const text = await getText(join(testRootDirectory, 'test-text/utf8.txt'), 'utf8', null);

            expect(text).to.equal('This text with some special characters: «ταБЬℓσ»: 1<2 & 4+1>3%, for this utf8 text!');
        });
    });
});