import * as sinon from 'sinon';
import {expect} from 'chai';
import * as sharp from 'sharp';

import RotateRequest from '../../src/image/RotateRequest';
import {RequestError} from '../../src/image/errors';

describe('RotateRequest', () => {
    const size = {width: 200, height: 100};

    describe('#parseImageRequest()', () => {
        [
            '0',
            '!0',
            '180',
            '!45',
            '30.5',
            '!44.34',
        ].forEach((request) => {
            it(`should not throw an error for ${request}`, () => {
                const rotateRequest = new RotateRequest(request);
                expect(() => {
                    rotateRequest.parseImageRequest(size);
                }).to.not.throw();
            });
        });

        [
            '-20',
            '!-48',
            '378',
            '-378',
            'abc',
        ].forEach((request) => {
            it(`should throw a request error for ${request}`, () => {
                const rotateRequest = new RotateRequest(request);
                expect(() => {
                    rotateRequest.parseImageRequest(size);
                }).to.throw(RequestError);
            });
        });
    });

    describe('#requiresImageProcessing()', () => {
        [
            '!0',
            '180',
            '!45',
            '30.5',
            '!44.34',
        ].forEach((request) => {
            it(`should require operation in case of ${request}`, () => {
                const rotateRequest = new RotateRequest(request);
                rotateRequest.parseImageRequest(size);
                expect(rotateRequest.requiresImageProcessing()).to.be.true;
            });
        });

        it('should not require operation in case of 0', () => {
            const rotateRequest = new RotateRequest('0');
            rotateRequest.parseImageRequest(size);
            expect(rotateRequest.requiresImageProcessing()).to.be.false;
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

        it('should not execute the rotate operation for 0', () => {
            imageMock
                .expects('rotate')
                .never();

            const rotateRequest = new RotateRequest('0');
            rotateRequest.parseImageRequest(size);
            rotateRequest.executeImageProcessing(image);

            imageMock.verify();
        });

        [
            {request: '180', rotate: 180},
            {request: '!45', rotate: 45},
            {request: '30.5', rotate: 31},
            {request: '!44.34', rotate: 44},
        ].forEach((testCase) => {
            it(`should execute the rotate operation correctly for ${testCase.request}`, () => {
                imageMock
                    .expects('rotate')
                    .once()
                    .withArgs(testCase.rotate);

                const rotateRequest = new RotateRequest(testCase.request);
                rotateRequest.parseImageRequest(size);
                rotateRequest.executeImageProcessing(image);

                imageMock.verify();
            });
        });

        [
            '0',
            '180',
            '30.5',
        ].forEach((request) => {
            it(`should not execute the flop operation for ${request}`, () => {
                imageMock
                    .expects('flop')
                    .never();

                const rotateRequest = new RotateRequest(request);
                rotateRequest.parseImageRequest(size);
                rotateRequest.executeImageProcessing(image);

                imageMock.verify();
            });
        });

        [
            '!0',
            '!45',
            '!44.34',
        ].forEach((request) => {
            it(`should execute the flop operation correctly for ${request}`, () => {
                imageMock
                    .expects('flop')
                    .once();

                const rotateRequest = new RotateRequest(request);
                rotateRequest.parseImageRequest(size);
                rotateRequest.executeImageProcessing(image);

                imageMock.verify();
            });
        });
    });
});