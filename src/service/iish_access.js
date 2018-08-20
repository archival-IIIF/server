const {AccessState, isIpInRange, checkTokenDb} = require('../lib/Security');

async function hasAccess({item, ip, identities}) {
    if (!ip || !identities || (identities.length === 0))
        return {state: AccessState.CLOSED};

    if (!isIpInRange(ip))
        return {state: AccessState.CLOSED};

    const tokensInfo = await checkTokenDb(identities);
    const tokenInfo = tokensInfo.find(tokenInfo => tokenInfo.container_id === item.container_id);
    const hasToken = tokenInfo !== undefined;

    if (hasToken && (item.type === 'image'))
        return {state: AccessState.TIERED, tier: {name: 'pictoright', maxSize: 450}};

    if (hasToken)
        return {state: AccessState.CLOSED};

    return {state: AccessState.OPEN};
}

module.exports = hasAccess;
