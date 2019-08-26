import * as sinon from 'sinon';
import {expect} from 'chai';
import * as sharp from 'sharp';

import SizeRequest from '../../src/image/SizeRequest';
import {RequestError} from '../../src/image/errors';

describe('SizeRequest', () => {
    const getSize = (width: number, height: number) => ({width: width, height: height});

    describe('#parseImageRequest()', () => {
        describe('having an image of 200 by 100', () => {
            const width = 200, height = 100;

            [
                {request: 'full', width: 200, height: 100},
                {request: 'max', width: 200, height: 100},
                {request: '50,', width: 50, height: 25},
                {request: ',50', width: 100, height: 50},
                {request: '50,50', width: 50, height: 50},
                {request: 'pct:50', width: 100, height: 50},
                {request: 'pct:22.1', width: 44, height: 22},
                {request: '!50,50', width: 50, height: 25},
            ].forEach((request) => {
                it(`should not throw an error for ${request.request}`, () => {
                    const sizeRequest = new SizeRequest(request.request);
                    expect(() => {
                        sizeRequest.parseImageRequest(getSize(width, height));
                    }).to.not.throw();
                });

                it(`should update the size of the ImageProcessingInfo object correctly for ${request.request}`, () => {
                    const size = getSize(width, height);
                    const sizeRequest = new SizeRequest(request.request);
                    sizeRequest.parseImageRequest(size);

                    expect(size.width).to.equal(request.width);
                    expect(size.height).to.equal(request.height);
                });
            });

            [
                'FULL',
                'half',
                'MaX',
                '50',
                '-50,',
                ',-50',
                '-0,',
                ',-0',
                '0,0',
                '-40,20',
                'pct:0',
                'pct:-5',
                'pct:50,20',
                '!-40,20',
                '!56,0',
            ].forEach((request) => {
                it(`should throw a request error for ${request}`, () => {
                    const sizeRequest = new SizeRequest(request);
                    expect(() => {
                        sizeRequest.parseImageRequest(getSize(width, height));
                    }).to.throw(RequestError);
                });
            });
        });
    });

    describe('#requiresImageProcessing()', () => {
        describe('having an image of 200 by 100', () => {
            const width = 200, height = 100;

            [
                '50,',
                ',50',
                '50,50',
                '!50,50',
                'pct:50',
            ].forEach((request) => {
                it(`should require operation in case of ${request}`, () => {
                    const sizeRequest = new SizeRequest(request);
                    sizeRequest.parseImageRequest(getSize(width, height));
                    expect(sizeRequest.requiresImageProcessing()).to.be.true;
                });
            });

            [
                'full',
                'max',
                '200,',
                ',100',
                '200,100',
                'pct:100',
                '!200,200',
            ].forEach((request) => {
                it(`should not require operation in case of ${request}`, () => {
                    const sizeRequest = new SizeRequest(request);
                    sizeRequest.parseImageRequest(getSize(width, height));
                    expect(sizeRequest.requiresImageProcessing()).to.be.false;
                });
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

        describe('having an image of 200 by 100', () => {
            const width = 200, height = 100;

            [
                'full',
                'max',
                '200,',
                ',100',
                '200,100',
                'pct:100',
                '!200,200',
            ].forEach((request) => {
                it(`should not execute the operation for ${request}`, () => {
                    imageMock
                        .expects('resize')
                        .never();

                    const sizeRequest = new SizeRequest(request);
                    sizeRequest.parseImageRequest(getSize(width, height));
                    sizeRequest.executeImageProcessing(image);

                    imageMock.verify();
                });
            });

            [
                {request: '50,', width: 50, height: null, fit: 'contain'},
                {request: ',50', width: null, height: 50, fit: 'contain'},
                {request: '50,50', width: 50, height: 50, fit: 'fill'},
                {request: '!50,50', width: 50, height: 50, fit: 'inside'},
                {request: 'pct:50', width: 100, height: null, fit: 'contain'},
            ].forEach((testCase) => {
                it(`should execute the operation correctly for ${testCase.request}`, () => {
                    imageMock
                        .expects('resize')
                        .once()
                        .withArgs(testCase.width, testCase.height, {fit: testCase.fit});

                    const sizeRequest = new SizeRequest(testCase.request);
                    sizeRequest.parseImageRequest(getSize(width, height));
                    sizeRequest.executeImageProcessing(image);

                    imageMock.verify();
                });
            });
        });
    });
});