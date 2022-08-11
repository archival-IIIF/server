import {join} from 'path';
import {expect} from 'chai';

import {getTextFromFile} from '../../src/service/text_index.js';

const testRootDirectory = './test/service';

describe('text_index', () => {
    describe('#getTextFromFile()', () => {
        it('should correctly obtain the text from an ALTO XML file', async () => {
            const text = await getTextFromFile(join(testRootDirectory, 'test-text/alto.xml'), 'utf8');

            expect(text).to.equal('The first block. This is one line of text.');
        });

        it('should correctly obtain the text from an UTF-8 encoded file', async () => {
            const text = await getTextFromFile(join(testRootDirectory, 'test-text/utf8.txt'), 'utf8');

            expect(text).to.equal('This text with some special characters: «ταБЬℓσ»: 1<2 & 4+1>3%, for this utf8 text!');
        });
    });
});