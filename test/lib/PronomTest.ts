import {expect} from 'chai';
import getPronomInfo, {PronomInfo} from '../../src/lib/Pronom';

describe('Pronom', () => {
    describe('#getPronomInfo()', () => {
        const pronomInfoObjects: { [puid: string]: PronomInfo } = {
            'fmt/19': {
                id: 618, name: 'Acrobat PDF 1.5 - Portable Document Format',
                url: 'https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=618',
                extensions: ['pdf'], mime: 'application/pdf'
            },
            'fmt/43': {
                id: 668, name: 'JPEG File Interchange Format',
                url: 'https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=668',
                extensions: ['jpe', 'jpeg', 'jpg'], mime: 'image/jpeg'
            },
            'fmt/199': {
                id: 924, name: 'MPEG-4 Media File',
                url: 'https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=924',
                extensions: ['f4a', 'f4v', 'm4a', 'm4v', 'mp4'], mime: 'video/mp4'
            },
            'fmt/60': {
                id: 683, name: 'Excel 95 Workbook (xls)',
                url: 'https://www.nationalarchives.gov.uk/PRONOM/Format/proFormatSearch.aspx?status=detailReport&id=683',
                extensions: [], mime: 'application/octet-stream'
            }
        };

        Object.keys(pronomInfoObjects).forEach(puid => {
            it(`should return the correct info for ${puid}`, () => {
                const pronomInfo = getPronomInfo(puid);
                expect(pronomInfo).to.deep.equal(pronomInfoObjects[puid]);
            });
        });

        it('should return false for invalid puids', () => {
            expect(getPronomInfo('')).to.equal(null);
            expect(getPronomInfo('fmt/not-existing-one')).to.equal(null);
        });
    });
});
