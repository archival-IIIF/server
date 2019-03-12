import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

import {Context} from 'koa';

import {setConfig} from '../../src/lib/Config';
import {setRedisClient} from '../../src/lib/Redis';
import {setElasticSearchClient} from '../../src/lib/ElasticSearch';

import {hasAdminAccess} from '../../src/lib/Security';

chai.use(sinonChai);
const expect = chai.expect;

describe('Security', () => {
    let redis: any;
    let elasticSearch: any;

    const accessToken = '12345-67890';
    const defaultCtx = {query: {}, request: {body: {}}, headers: {}};

    beforeEach(() => {
        redis = {};
        elasticSearch = {};

        setConfig('accessToken', accessToken);
        setRedisClient(redis);
        setElasticSearchClient(elasticSearch);
    });

    afterEach(() => {
        sinon.restore();
    });

    // describe('#hasAccess()', () => {
    //
    // });

    describe('#hasAdminAccess()', () => {
        it('should return true if the request body contains a valid access token', () => {
            const ctx = {...defaultCtx, request: {body: {access_token: accessToken}}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request body does not contain a valid access token', () => {
            const ctx = {...defaultCtx, request: {body: {access_token: 'not-valid'}}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.false;
        });

        it('should return true if the request query contains a valid access token', () => {
            const ctx = {...defaultCtx, query: {access_token: accessToken}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request query does not contain a valid access token', () => {
            const ctx = {...defaultCtx, query: {access_token: 'not-valid'}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.false;
        });

        it('should return true if the request header contains a valid access token', () => {
            const ctx = {...defaultCtx, headers: {authorization: `Bearer ${accessToken}`}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request header does not contain a valid access token', () => {
            const ctx = {...defaultCtx, headers: {authorization: `Bearer not-valid`}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.false;
        });

        it('should return false if the request does not contain an access token', () => {
            const hasAccess = hasAdminAccess(defaultCtx as Context);
            expect(hasAccess).to.be.false;
        });
    });
});
