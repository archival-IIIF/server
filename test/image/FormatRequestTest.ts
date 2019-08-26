import * as sinon from 'sinon';
import {expect} from 'chai';
import * as sharp from 'sharp';

import FormatRequest from '../../src/image/FormatRequest';
import {NotImplementedError, RequestError} from '../../src/image/errors';

describe('FormatRequest', () => {
    const size = {width: 200, height: 100};

    describe('#parseImageRequest()', () => {
        [
            'jpg',
            'png',
            'webp',
            'tif',
        ].forEach((request) => {
            it(`should not throw an error for ${request}`, () => {
                const formatRequest = new FormatRequest(request);
                expect(() => {
                    formatRequest.parseImageRequest(size);
                }).to.not.throw();
            });
        });

        [
            'image',
            'JPG',
            'pNg',
        ].forEach((request) => {
            it(`should throw a request error for ${request}`, () => {
                const formatRequest = new FormatRequest(request);
                expect(() => {
                    formatRequest.parseImageRequest(size);
                }).to.throw(RequestError);
            });
        });

        [
            'gif',
            'jp2',
            'pdf',
        ].forEach((request) => {
            it(`should throw a not implemented error for ${request}`, () => {
                const formatRequest = new FormatRequest(request);
                expect(() => {
                    formatRequest.parseImageRequest(size);
                }).to.throw(NotImplementedError);
            });
        });
    });

    describe('#requiresImageProcessing()', () => {
        [
            'jpg',
            'png',
            'webp',
            'tif',
        ].forEach((request) => {
            it(`should always require operation in case of ${request}`, () => {
                const formatRequest = new FormatRequest(request);
                formatRequest.parseImageRequest(size);
                expect(formatRequest.requiresImageProcessing()).to.be.true;
            });
        });
    });

    describe('#executeImageProcessing()', () => {
        const image = sharp();
        let imageMock: sinon.SinonMock;

        beforeEach(() => {
            imageMock = sinon.mock(image);
        });

        afterEach(() => {
            imageMock.restore();
        });

        [
            {request: 'jpg', id: 'jpeg'},
            {request: 'png', id: 'png'},
            {request: 'webp', id: 'webp'},
            {request: 'tif', id: 'tiff'}
        ].forEach((testCase) => {
            it(`should execute the operation correctly for ${testCase.request}`, () => {
                imageMock
                    .expects('toFormat')
                    .once()
                    .withArgs(testCase.id);

                const formatRequest = new FormatRequest(testCase.request);
                formatRequest.parseImageRequest(size);
                formatRequest.executeImageProcessing(image);

                imageMock.verify();
            });
        });
    });
});