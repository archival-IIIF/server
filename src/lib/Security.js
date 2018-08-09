const moment = require('moment');
const rangeCheck = require('range_check');
const uuid = require('uuid/v4');
const {promisify} = require('util');

const {db} = require('./DB');
const {client} = require('./Redis');
const config = require('./Config');
const {runTaskWithResponse} = require('./Task');

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

const enabledAuthServices = [];
if (!config.loginDisabled)
    enabledAuthServices.push('login');
if (!config.internalIpAddresses.length > 0)
    enabledAuthServices.push('external');

async function hasAccess(ctx, item) {
    if (!config.loginDisabled || (config.internalIpAddresses.length > 0)) {
        const ip = ctx.ip;
        const accessId = await getAccessIdFromRequest(ctx);
        const identities = await getIdentitiesForAccessId(accessId);

        return await runTaskWithResponse('access', {item, ip, identities});
    }

    return true;
}

async function requiresAuthentication(item) {
    if (!config.loginDisabled || (config.internalIpAddresses.length > 0)) {
        const hasAccessForItem = await runTaskWithResponse('access', {item});
        return hasAccessForItem !== true;
    }

    return false;
}

async function getAuthTexts(item, type) {
    return await runTaskWithResponse('auth-texts', {item, type});
}

function isIpInRange(ip) {
    if (config.internalIpAddresses.length > 0) {
        const foundMatch = config.internalIpAddresses.find(ipRange => rangeCheck.inRange(ip, ipRange));
        return foundMatch !== undefined;
    }
    return true;
}

async function checkTokenDb(tokens) {
    const tokensInfo = await db.query('SELECT * FROM tokens WHERE token IN ($1:csv);', tokens);

    return tokensInfo.filter(tokenInfo => {
        if (tokenInfo.from && tokenInfo.to && !moment().isBetween(moment(tokenInfo.from), moment(tokenInfo.to)))
            return false;

        if (tokenInfo.from && !moment().isAfter(moment(tokenInfo.from)))
            return false;

        return !(tokenInfo.to && !moment().isBefore(moment(tokenInfo.to)));

    });
}

async function getIdentitiesForAccessId(acccesId) {
    const identities = await getAsync(`access-id:${acccesId}`);
    if (identities)
        return JSON.parse(identities);
    return [];
}

async function setAccessIdForIdentity(identity, accessId = null) {
    const identities = [];

    if (accessId)
        identities.push(await getIdentitiesForAccessId(accessId));
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

async function getAccessIdFromRequest(ctx) {
    if (ctx.headers.hasOwnProperty('authorization')) {
        const accessToken = ctx.headers.authorization.replace('Bearer', '').trim();
        return await getAccessIdForAccessToken(accessToken);
    }
    return ctx.cookies.get('access');
}

module.exports = {
    enabledAuthServices,
    hasAccess,
    requiresAuthentication,
    getAuthTexts,
    isIpInRange,
    checkTokenDb,
    setAccessIdForIdentity,
    setAccessTokenForAccessId,
    getAccessIdFromRequest
};