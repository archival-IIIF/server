import sinon from 'sinon';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';

import {createItem} from '../../src/lib/Item.js';
import {setRedisClient} from '../../src/lib/Redis.js';
import config, {setConfig} from '../../src/lib/Config.js';
import {AccessParams} from '../../src/lib/ServiceTypes.js';

import {
    Access, AccessState, hasAccess, hasAdminAccess, requiresAuthentication, isIpInRange,
    setAccessIdForIdentity, setAccessTokenForAccessId, getAccessIdFromRequest, removeAccessIdFromRequest
} from '../../src/lib/Security.js';
import {setLibsRunning} from '../../src/lib/Service.js';
import {extendContext, ExtendedContext} from '../../src/lib/Koa.js';

chai.use(sinonChai);
const expect = chai.expect;

describe('Security', () => {
    let redis: any;
    let redisMulti: any;

    const identity = 'identity';
    const accessId = 'access12345';
    const newAccessId = 'newaccess12345';
    const accessToken = '12345';
    const adminAccessToken = '12345-67890';
    const defaultCtx = {
        ip: '127.0.0.1',
        query: {},
        request: {body: {}},
        headers: {},
        cookies: {get: (name: string) => accessId}
    } as ExtendedContext;
    extendContext(defaultCtx);

    const openItem = createItem({id: 'open', collection_id: 'test', label: 'Open item'});
    const tieredItem = createItem({id: 'tiered', collection_id: 'test', label: 'Tiered item'});
    const closedItem = createItem({id: 'closed', collection_id: 'test', label: 'Closed item'});

    beforeEach(() => {
        const redisGetStub = sinon.stub();
        redisGetStub
            .withArgs(`access-token:${accessToken}`)
            .resolves(accessId);
        redisGetStub
            .withArgs(`access-id:${accessId}`)
            .resolves(JSON.stringify({identities: [identity], token: accessToken}));
        redisGetStub
            .withArgs(`access-id:${newAccessId}`)
            .resolves(JSON.stringify({identities: [identity], token: null}));
        redisGetStub.resolves(null as any);

        redisMulti = {
            set: sinon.stub().returnsThis(),
            expire: sinon.stub().returnsThis(),
            del: sinon.stub().returnsThis(),
            exec: sinon.fake()
        };

        redis = {
            set: sinon.stub().resolves('OK'),
            del: sinon.stub().resolves(1),
            get: redisGetStub,
            multi: () => redisMulti
        };

        setConfig('accessToken', adminAccessToken);
        setRedisClient(redis);
        setLibsRunning({
            access: {
                name: 'access-for-test',
                loadService: async () => async ({item, ip, identities = []}: AccessParams): Promise<Access> => {
                    switch (item) {
                        case openItem:
                            return {state: AccessState.OPEN};
                        case tieredItem:
                            return {state: AccessState.TIERED, tier: {name: 'tiered', maxSize: 500}};
                        case closedItem:
                        default:
                            return {state: AccessState.CLOSED};
                    }
                }
            }
        });
    });

    afterEach(() => {
        sinon.restore();

        setConfig('loginEnabled', false);
        setConfig('externalEnabled', false);
        setConfig('internalIpAddresses', []);

        setRedisClient(null);
    });

    describe('#hasAccess()', () => {
        it('should always return open access if the request includes admin rights', async () => {
            const ctx: unknown = {...defaultCtx, request: {body: {access_token: adminAccessToken}}};
            const access = await hasAccess(ctx as ExtendedContext, closedItem);
            expect(access).to.deep.equal({state: AccessState.OPEN});
        });

        it('should return access from service if authentication is enabled for open item', async () => {
            setConfig('loginEnabled', true);
            const access = await hasAccess(defaultCtx as ExtendedContext, openItem);
            expect(access).to.deep.equal({state: AccessState.OPEN});
        });

        it('should return restricted access from service if authentication is enabled for tiered item', async () => {
            setConfig('loginEnabled', true);
            const access = await hasAccess(defaultCtx as ExtendedContext, tieredItem);
            expect(access).to.deep.equal({state: AccessState.TIERED, tier: {name: 'tiered', maxSize: 500}});
        });

        it('should return closed access from service if authentication is enabled for closed item', async () => {
            setConfig('loginEnabled', true);
            const access = await hasAccess(defaultCtx as ExtendedContext, closedItem);
            expect(access).to.deep.equal({state: AccessState.CLOSED});
        });
    });

    describe('#hasAdminAccess()', () => {
        it('should return true if the request body contains a valid access token', () => {
            const ctx: unknown = {...defaultCtx, request: {body: {access_token: adminAccessToken}}};
            const hasAccess = hasAdminAccess(ctx as ExtendedContext);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request body does not contain a valid access token', () => {
            const ctx: unknown = {...defaultCtx, request: {body: {access_token: 'not-valid'}}};
            const hasAccess = hasAdminAccess(ctx as ExtendedContext);
            expect(hasAccess).to.be.false;
        });

        it('should return true if the request query contains a valid access token', () => {
            const ctx = {...defaultCtx, query: {access_token: adminAccessToken}};
            const hasAccess = hasAdminAccess(ctx);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request query does not contain a valid access token', () => {
            const ctx = {...defaultCtx, query: {access_token: 'not-valid'}};
            const hasAccess = hasAdminAccess(ctx as ExtendedContext);
            expect(hasAccess).to.be.false;
        });

        it('should return true if the request header contains a valid access token', () => {
            const ctx = {...defaultCtx, headers: {authorization: `Bearer ${adminAccessToken}`}};
            const hasAccess = hasAdminAccess(ctx as ExtendedContext);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request header does not contain a valid access token', () => {
            const ctx = {...defaultCtx, headers: {authorization: 'Bearer not-valid'}};
            const hasAccess = hasAdminAccess(ctx as ExtendedContext);
            expect(hasAccess).to.be.false;
        });

        it('should return false if the request does not contain an access token', () => {
            const hasAccess = hasAdminAccess(defaultCtx as ExtendedContext);
            expect(hasAccess).to.be.false;
        });
    });

    describe('#requiresAuthentication()', () => {
        it('should always return false if authentication is disabled', async () => {
            const requiresAuth = await requiresAuthentication(closedItem);
            expect(requiresAuth).to.be.false;
        });

        it('should return false from service if authentication is enabled for open item', async () => {
            setConfig('loginEnabled', true);
            const requiresAuth = await requiresAuthentication(openItem);
            expect(requiresAuth).to.be.false;
        });

        it('should return true from service if authentication is enabled for tiered item', async () => {
            setConfig('loginEnabled', true);
            const requiresAuth = await requiresAuthentication(tieredItem);
            expect(requiresAuth).to.be.true;
        });

        it('should return true from service if authentication is enabled for closed item', async () => {
            setConfig('loginEnabled', true);
            const requiresAuth = await requiresAuthentication(closedItem);
            expect(requiresAuth).to.be.true;
        });
    });

    describe('#isIpInRange()', () => {
        it('should always return true if there are no ip ranges configured', () => {
            const isInRange = isIpInRange('10.0.0.10');
            expect(isInRange).to.be.true;
        });

        it('should return false if the ip matches none of the ip ranges configured', () => {
            setConfig('internalIpAddresses', ['172.16.0.0/12', '192.168.0.0/16']);
            const isInRange = isIpInRange('10.0.0.10');
            expect(isInRange).to.be.false;
        });

        it('should true if the ip matches none of the ip ranges configured', () => {
            setConfig('internalIpAddresses', ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);
            const isInRange = isIpInRange('10.0.0.10');
            expect(isInRange).to.be.true;
        });
    });

    describe('#setAccessIdForIdentity()', () => {
        it('should send no update for already coupled identity with access id', async () => {
            await setAccessIdForIdentity(identity, accessId);
            expect(redis.set).to.have.not.been.called;
        });

        it('should send an update for a newly coupled identity with access id', async () => {
            await setAccessIdForIdentity('new-identity', accessId);
            expect(redis.set).to.have.been.calledWithExactly(
                `access-id:${accessId}`,
                JSON.stringify({identities: [identity, 'new-identity'], token: accessToken}),
                {'EX': config.accessTtl}
            );
        });

        it('should create an access id whe not given', async () => {
            const newAccessId = await setAccessIdForIdentity(identity);
            expect(newAccessId).to.not.equal(accessId);
            expect(newAccessId).to.be.a('string');
            expect(redis.set).to.have.been.calledWithExactly(
                `access-id:${newAccessId}`,
                JSON.stringify({identities: [identity], token: null}),
                {'EX': config.accessTtl}
            );
        });
    });

    describe('#setAccessTokenForAccessId()', () => {
        it('should send no updates for already coupled access token with access id', async () => {
            await setAccessTokenForAccessId(accessId);
            expect(redisMulti.exec).to.have.not.been.called;
        });

        it('should create an access token and send an update for a new access id without access token', async () => {
            const newAccessToken = await setAccessTokenForAccessId(newAccessId);

            const expectedAccessIdInfo = JSON.stringify({identities: [identity], token: newAccessToken});

            expect(newAccessToken).to.be.a('string');
            expect(redisMulti.exec).to.have.been.called;
            expect(redisMulti.set).to.have.been.calledWithExactly(`access-token:${newAccessToken}`, newAccessId);
            expect(redisMulti.expire).to.have.been.calledWithExactly(`access-token:${newAccessToken}`, config.accessTtl);
            expect(redisMulti.set).to.have.been.calledWithExactly(`access-id:${newAccessId}`, expectedAccessIdInfo);
            expect(redisMulti.expire).to.have.been.calledWithExactly(`access-id:${newAccessId}`, config.accessTtl);
        });
    });

    describe('#getAccessIdFromRequest()', () => {
        it('should not obtain the access id if there is no cookie or access token', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => undefined},
                headers: {}
            };

            const accessIdFromRequest = await getAccessIdFromRequest(ctx as ExtendedContext);
            expect(accessIdFromRequest).to.be.null;
        });

        it('should obtain the access id from the cookie', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => accessId},
                headers: {}
            };

            const accessIdFromRequest = await getAccessIdFromRequest(ctx as ExtendedContext);
            expect(accessIdFromRequest).to.equal(accessId);
        });

        it('should not obtain the access id based on the access token', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => undefined},
                headers: {authorization: `Bearer access-token-from-header`}
            };

            const accessIdFromRequest = await getAccessIdFromRequest(ctx as ExtendedContext);
            expect(accessIdFromRequest).to.be.null;
        });

        it('should obtain the access id based on the access token if explicitly allowed', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => undefined},
                headers: {authorization: `Bearer ${accessToken}`}
            };

            const accessIdFromRequest = await getAccessIdFromRequest(ctx as ExtendedContext, true);
            expect(accessIdFromRequest).to.equal(accessId);
        });
    });

    describe('#removeAccessIdFromRequest()', () => {
        it('should not remove the access id if the request does not have an access id', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => undefined},
                headers: {}
            };

            await removeAccessIdFromRequest(ctx as ExtendedContext);
            expect(redis.del).to.have.not.been.called;
        });

        it('should remove the access id obtained from the cookie and the access token', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => accessId},
                headers: {}
            };

            await removeAccessIdFromRequest(ctx as ExtendedContext);

            expect(redisMulti.del).to.have.been.calledTwice;
            expect(redisMulti.del.getCall(0)).to.have.been.calledWithExactly(`access-id:${accessId}`);
            expect(redisMulti.del.getCall(1)).to.have.been.calledWithExactly(`access-token:${accessToken}`);
        });
    });
});
