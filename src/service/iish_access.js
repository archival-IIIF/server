const {AccessState, isIpInRange, checkTokenDb} = require('../lib/Security');

async function hasAccess({item, ip, identities}) {
    if (item.collection_id === null)
        return {state: AccessState.OPEN};

    const accessCode = (item.iish && item.iish.access) ? item.iish.access : 'open';
    if (accessCode === 'open')
        return {state: AccessState.OPEN};

    if (accessCode === 'eadRestricted') {
        if (isIpInRange(ip) || await hasToken(item, identities))
            return {state: AccessState.OPEN};

        return {state: AccessState.CLOSED};
    }

    if (accessCode === 'restricted') {
        if (isIpInRange(ip) || await hasToken(item, identities))
            return {state: AccessState.OPEN};

        if (item.type === 'image')
            return {state: AccessState.TIERED, tier: {name: accessCode, maxSize: 1500}};

        return {state: AccessState.CLOSED};
    }

    if (accessCode === 'minimal' || accessCode === 'pictoright') {
        if (isIpInRange(ip) || await hasToken(item, identities))
            return {state: AccessState.OPEN};

        if (item.type === 'image')
            return {state: AccessState.TIERED, tier: {name: accessCode, maxSize: 450}};

        return {state: AccessState.CLOSED};
    }

    if (isIpInRange(ip) || await hasToken(item, identities))
        return {state: AccessState.OPEN};

    return {state: AccessState.CLOSED};
}

async function hasToken(item, identities) {
    const tokensInfo = await checkTokenDb(identities);
    const tokenInfo = tokensInfo.find(tokenInfo => tokenInfo.collection_id === item.collection_id);
    return tokenInfo !== undefined;
}

module.exports = hasAccess;
