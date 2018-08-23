const moment = require('moment');
const rangeCheck = require('range_check');
const uuid = require('uuid/v4');
const {promisify} = require('util');

const {client} = require('./Redis');
const config = require('./Config');
const logger = require('./Logger');
const esClient = require('./ElasticSearch');
const {runTaskWithResponse} = require('./Task');

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

const isLoginEnabled = !config.loginDisabled;
const isExternalEnabled = config.internalIpAddresses.length > 0;
const isAuthenticationEnabled = isLoginEnabled || isExternalEnabled;

const enabledAuthServices = [];
if (isLoginEnabled)
    enabledAuthServices.push('login');
if (isExternalEnabled)
    enabledAuthServices.push('external');

const AccessState = Object.freeze({
    OPEN: Symbol('open'),
    CLOSED: Symbol('closed'),
    TIERED: Symbol('tiered')
});

async function hasAccess(ctx, item, acceptToken = false) {
    if (isAuthenticationEnabled) {
        const ip = ctx.ip;
        const accessId = await getAccessIdFromRequest(ctx, acceptToken);
        const identities = await getIdentitiesForAccessId(accessId);

        if (accessId && identities.length > 0)
            logger.debug('Determining access with an access id and matching identities');
        else if (accessId)
            logger.debug('Determining access with an access id but no matching identities');
        else
            logger.debug('Determining access with no access id and no identities');

        return await runTaskWithResponse('access', {item, ip, identities});
    }

    return {state: AccessState.OPEN};
}

async function requiresAuthentication(item) {
    if (isAuthenticationEnabled) {
        const access = await runTaskWithResponse('access', {item});
        return access.state !== AccessState.OPEN;
    }

    return false;
}

async function getAuthTexts(item, type) {
    return await runTaskWithResponse('auth-texts', {item, type});
}

function isIpInRange(ip) {
    if (isExternalEnabled) {
        const foundMatch = config.internalIpAddresses.find(ipRange => rangeCheck.inRange(ip, ipRange));
        return foundMatch !== undefined;
    }
    return true;
}

async function checkTokenDb(tokens) {
    try {
        const response = await esClient.search({
            index: 'tokens',
            size: 100,
            body: {
                query: {
                    terms: {'token': tokens}
                }
            },
        });

        const tokensInfo = response.hits.hits.map(hit => hit._source);
        return tokensInfo.filter(tokenInfo => {
            if (tokenInfo.from && tokenInfo.to && !moment().isBetween(moment(tokenInfo.from), moment(tokenInfo.to)))
                return false;

            if (tokenInfo.from && !moment().isAfter(moment(tokenInfo.from)))
                return false;

            return !(tokenInfo.to && !moment().isBefore(moment(tokenInfo.to)));
        });
    }
    catch (err) {
        return [];
    }
}

async function getIdentitiesForAccessId(acccesId) {
    const identities = await getAsync(`access-id:${acccesId}`);
    if (identities)
        return JSON.parse(identities);
    return [];
}

async function setAccessIdForIdentity(identity, accessId) {
    const identities = [];

    if (accessId)
        identities.push(...(await getIdentitiesForAccessId(accessId)));
    else
        accessId = uuid();

    if (!identities.includes(identity)) {
        identities.push(identity);
        await setAsync(`access-id:${accessId}`, JSON.stringify(identities), 'EX', 86400);
    }

    return accessId;
}

async function setAccessTokenForAccessId(accessId) {
    const accessToken = uuid();
    await setAsync(`access-token:${accessToken}`, accessId, 'EX', 86400);
    return accessToken;
}

async function getAccessIdForAccessToken(accessToken) {
    return await getAsync(`access-token:${accessToken}`);
}

async function getAccessIdFromRequest(ctx, acceptToken = false) {
    if (acceptToken && ctx.headers.hasOwnProperty('authorization')) {
        logger.debug('Found token in header for current request');

        const accessToken = ctx.headers.authorization.replace('Bearer', '').trim();
        return await getAccessIdForAccessToken(accessToken);
    }

    const accessCookie = ctx.cookies.get('access');
    if (accessCookie)
        logger.debug('Found access cookie for current request');

    return accessCookie;
}

module.exports = {
    enabledAuthServices,
    AccessState,
    hasAccess,
    requiresAuthentication,
    getAuthTexts,
    isIpInRange,
    checkTokenDb,
    setAccessIdForIdentity,
    setAccessTokenForAccessId,
    getAccessIdFromRequest
};
