import * as sinon from 'sinon';
import {expect} from 'chai';
import * as sharp from 'sharp';

import QualityRequest from '../../src/image/QualityRequest';
import {RequestError} from '../../src/image/errors';

describe('QualityRequest', () => {
    const size = {width: 200, height: 100};

    describe('#parseImageRequest()', () => {
        [
            'default',
            'color',
            'gray',
            'bitonal',
        ].forEach((request) => {
            it(`should not throw an error for ${request}`, () => {
                const qualityRequest = new QualityRequest(request);
                expect(() => {
                    qualityRequest.parseImageRequest(size);
                }).to.not.throw();
            });
        });

        [
            'deFaUlt',
            'COLOR',
            'black',
        ].forEach((request) => {
            it(`should throw a request error for ${request}`, () => {
                const qualityRequest = new QualityRequest(request);
                expect(() => {
                    qualityRequest.parseImageRequest(size);
                }).to.throw(RequestError);
            });
        });
    });

    describe('#requiresImageProcessing()', () => {
        [
            'gray',
            'bitonal',
        ].forEach((request) => {
            it(`should require operation in case of ${request}`, () => {
                const qualityRequest = new QualityRequest(request);
                qualityRequest.parseImageRequest(size);
                expect(qualityRequest.requiresImageProcessing()).to.be.true;
            });
        });

        [
            'default',
            'color',
        ].forEach((request) => {
            it(`should not require operation in case of ${request}`, () => {
                const qualityRequest = new QualityRequest(request);
                qualityRequest.parseImageRequest(size);
                expect(qualityRequest.requiresImageProcessing()).to.be.false;
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

        it('should execute the operation correctly for gray', () => {
            imageMock
                .expects('gamma')
                .once()
                .callThrough();

            imageMock
                .expects('grayscale')
                .once();

            const qualityRequest = new QualityRequest('gray');
            qualityRequest.parseImageRequest(size);
            qualityRequest.executeImageProcessing(image);

            imageMock.verify();
        });

        it('should execute the operation correctly for bitonal', () => {
            imageMock
                .expects('threshold')
                .once();

            const qualityRequest = new QualityRequest('bitonal');
            qualityRequest.parseImageRequest(size);
            qualityRequest.executeImageProcessing(image);

            imageMock.verify();
        });
    });
});