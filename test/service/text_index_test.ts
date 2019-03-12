import {join} from 'path';
import {expect} from 'chai';

import {getTextFromFile} from '../../src/service/text_index';

describe('text_index', () => {
    describe('#getTextFromFile()', () => {
        it('should correctly obtain the text from an ALTO XML file', async () => {
            const text = await getTextFromFile(join(__dirname, '../resources/test-text/alto.xml'));

            expect(text).to.equal('The first block. This is one line of text.');
        });

        it('should correctly obtain the text from an UTF-8 encoded file', async () => {
            const text = await getTextFromFile(join(__dirname, '../resources/test-text/utf8.txt'));

            expect(text).to.equal('This text with some special characters: «ταБЬℓσ»: 1<2 & 4+1>3%, for this utf8 text!');
        });

        it('should correctly obtain the text from a ISO-8859-2 encoded file', async () => {
            const text = await getTextFromFile(join(__dirname, '../resources/test-text/iso-8859-2.txt'));

            expect(text).to.equal('This text with some special characters: 1<2 & 4+1>3%, for this ISO-8859-2 text!');
        });
    });
});