import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

import {Context} from 'koa';

import {createItem} from '../../src/lib/Item';
import {setConfig} from '../../src/lib/Config';
import {setRedisClient} from '../../src/lib/Redis';
import {setElasticSearchClient} from '../../src/lib/ElasticSearch';
import {AccessParams, setServicesRunning} from '../../src/lib/Service';

import {
    Access, AccessState, getEnabledAuthServices, hasAccess, hasAdminAccess, requiresAuthentication, isIpInRange,
    setAccessIdForIdentity, setAccessTokenForAccessId, getAccessIdFromRequest, removeAccessIdFromRequest
} from '../../src/lib/Security';

chai.use(sinonChai);
const expect = chai.expect;

describe('Security', () => {
    let redis: any;
    let elasticSearch: any;

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
    };

    const openItem = createItem({id: 'open', collection_id: 'test', label: 'Open item'});
    const tieredItem = createItem({id: 'tiered', collection_id: 'test', label: 'Tiered item'});
    const closedItem = createItem({id: 'closed', collection_id: 'test', label: 'Closed item'});

    async function determineAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
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

        redis = {
            set: sinon.stub().resolves('OK'),
            del: sinon.stub().resolves(1),
            get: redisGetStub
        };
        elasticSearch = {};

        setConfig('accessToken', adminAccessToken);

        setRedisClient(redis);
        setElasticSearchClient(elasticSearch);

        setServicesRunning([{
            name: 'access-for-test',
            type: 'access',
            runAs: 'lib',
            getService: () => determineAccess
        }]);
    });

    afterEach(() => {
        sinon.restore();

        setConfig('loginDisabled', true);
        setConfig('internalIpAddresses', []);
    });

    describe('#getEnabledAuthServices()', () => {
        it('should return no enabled services if all is disabled', () => {
            const enabledAuthServices = getEnabledAuthServices();
            expect(enabledAuthServices).to.be.empty;
        });

        it('should return the login service if login is enabled', () => {
            setConfig('loginDisabled', false);
            const enabledAuthServices = getEnabledAuthServices();

            expect(enabledAuthServices).to.include('login');
            expect(enabledAuthServices).to.have.length(1);
        });

        it('should return the external service if ip checking is enabled', () => {
            setConfig('internalIpAddresses', ['127.0.0.1']);
            const enabledAuthServices = getEnabledAuthServices();

            expect(enabledAuthServices).to.include('external');
            expect(enabledAuthServices).to.have.length(1);
        });

        it('should return the login and the external service if login and ip checking is enabled', () => {
            setConfig('loginDisabled', false);
            setConfig('internalIpAddresses', ['127.0.0.1']);
            const enabledAuthServices = getEnabledAuthServices();

            expect(enabledAuthServices).to.include('login');
            expect(enabledAuthServices).to.include('external');
            expect(enabledAuthServices).to.have.length(2);
        });
    });

    describe('#hasAccess()', () => {
        it('should always return open access if the request includes admin rights', async () => {
            const ctx = {...defaultCtx, request: {body: {access_token: adminAccessToken}}};
            const access = await hasAccess(ctx as Context, closedItem);
            expect(access).to.deep.equal({state: AccessState.OPEN});
        });

        it('should always return open access if authentication is disabled', async () => {
            const access = await hasAccess(defaultCtx as Context, closedItem);
            expect(access).to.deep.equal({state: AccessState.OPEN});
        });

        it('should return access from service if authentication is enabled for open item', async () => {
            setConfig('loginDisabled', false);
            const access = await hasAccess(defaultCtx as Context, openItem);
            expect(access).to.deep.equal({state: AccessState.OPEN});
        });

        it('should return restricted access from service if authentication is enabled for tiered item', async () => {
            setConfig('loginDisabled', false);
            const access = await hasAccess(defaultCtx as Context, tieredItem);
            expect(access).to.deep.equal({state: AccessState.TIERED, tier: {name: 'tiered', maxSize: 500}});
        });

        it('should return closed access from service if authentication is enabled for closed item', async () => {
            setConfig('loginDisabled', false);
            const access = await hasAccess(defaultCtx as Context, closedItem);
            expect(access).to.deep.equal({state: AccessState.CLOSED});
        });
    });

    describe('#hasAdminAccess()', () => {
        it('should return true if the request body contains a valid access token', () => {
            const ctx = {...defaultCtx, request: {body: {access_token: adminAccessToken}}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request body does not contain a valid access token', () => {
            const ctx = {...defaultCtx, request: {body: {access_token: 'not-valid'}}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.false;
        });

        it('should return true if the request query contains a valid access token', () => {
            const ctx = {...defaultCtx, query: {access_token: adminAccessToken}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request query does not contain a valid access token', () => {
            const ctx = {...defaultCtx, query: {access_token: 'not-valid'}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.false;
        });

        it('should return true if the request header contains a valid access token', () => {
            const ctx = {...defaultCtx, headers: {authorization: `Bearer ${adminAccessToken}`}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.true;
        });

        it('should return false if the request header does not contain a valid access token', () => {
            const ctx = {...defaultCtx, headers: {authorization: 'Bearer not-valid'}};
            const hasAccess = hasAdminAccess(ctx as Context);
            expect(hasAccess).to.be.false;
        });

        it('should return false if the request does not contain an access token', () => {
            const hasAccess = hasAdminAccess(defaultCtx as Context);
            expect(hasAccess).to.be.false;
        });
    });

    describe('#requiresAuthentication()', () => {
        it('should always return false if authentication is disabled', async () => {
            const requiresAuth = await requiresAuthentication(closedItem);
            expect(requiresAuth).to.be.false;
        });

        it('should return false from service if authentication is enabled for open item', async () => {
            setConfig('loginDisabled', false);
            const requiresAuth = await requiresAuthentication(openItem);
            expect(requiresAuth).to.be.false;
        });

        it('should return true from service if authentication is enabled for tiered item', async () => {
            setConfig('loginDisabled', false);
            const requiresAuth = await requiresAuthentication(tieredItem);
            expect(requiresAuth).to.be.true;
        });

        it('should return true from service if authentication is enabled for closed item', async () => {
            setConfig('loginDisabled', false);
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
                ['EX', 86400]
            );
        });

        it('should create an access id whe not given', async () => {
            const newAccessId = await setAccessIdForIdentity(identity);
            expect(newAccessId).to.not.equal(accessId);
            expect(newAccessId).to.be.a('string');
            expect(redis.set).to.have.been.calledWithExactly(
                `access-id:${newAccessId}`,
                JSON.stringify({identities: [identity], token: null}),
                ['EX', 86400]
            );
        });
    });

    describe('#setAccessTokenForAccessId()', () => {
        it('should end no updates for already coupled access token with access id', async () => {
            await setAccessTokenForAccessId(accessId);
            expect(redis.set).to.have.not.been.called;
        });

        it('should create an access token and send an update for a new access id without access token', async () => {
            const newAccessToken = await setAccessTokenForAccessId(newAccessId);

            expect(newAccessToken).to.be.a('string');
            expect(redis.set).to.have.been.calledWithExactly(
                `access-token:${newAccessToken}`,
                newAccessId,
                ['EX', 86400]
            );
            expect(redis.set).to.have.been.calledWithExactly(
                `access-id:${newAccessId}`,
                JSON.stringify({identities: [identity], token: newAccessToken}),
                ['EX', 86400]
            );
        });
    });

    describe('#getAccessIdFromRequest()', () => {
        it('should not obtain the access id if there is no cookie or access token', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => undefined},
                headers: {}
            };

            const accessIdFromRequest = await getAccessIdFromRequest(ctx as Context);
            expect(accessIdFromRequest).to.be.null;
        });

        it('should obtain the access id from the cookie', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => accessId},
                headers: {}
            };

            const accessIdFromRequest = await getAccessIdFromRequest(ctx as Context);
            expect(accessIdFromRequest).to.equal(accessId);
        });

        it('should not obtain the access id based on the access token', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => undefined},
                headers: {authorization: `Bearer access-token-from-header`}
            };

            const accessIdFromRequest = await getAccessIdFromRequest(ctx as Context);
            expect(accessIdFromRequest).to.be.null;
        });

        it('should obtain the access id based on the access token if explicitly allowed', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => undefined},
                headers: {authorization: `Bearer ${accessToken}`}
            };

            const accessIdFromRequest = await getAccessIdFromRequest(ctx as Context, true);
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

            await removeAccessIdFromRequest(ctx as Context);
            expect(redis.del).to.have.not.been.called;
        });

        it('should remove the access id obtained from the cookie and the access token', async () => {
            const ctx = {
                ...defaultCtx,
                cookies: {get: (name: string) => accessId},
                headers: {}
            };

            await removeAccessIdFromRequest(ctx as Context);

            expect(redis.del).to.have.been.calledWithExactly(`access-id:${accessId}`);
            expect(redis.del).to.have.been.calledWithExactly(`access-token:${accessToken}`);
        });
    });
});
