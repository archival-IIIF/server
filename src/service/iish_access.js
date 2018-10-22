const {AccessState, isIpInRange, checkTokenDb} = require('../lib/Security');

async function hasAccess({item, ip, identities}) {
    // if (item.collection_id !== 'test')
    //     return {state: AccessState.OPEN};

    if (item.collection_id === null)
         return {state: AccessState.OPEN};

    if (!ip && (!identities || (identities.length === 0)))
        return {state: AccessState.CLOSED};

    if (!isIpInRange(ip))
        return {state: AccessState.CLOSED};

    if (identities && identities.length > 0) {
        const tokensInfo = await checkTokenDb(identities);
        const tokenInfo = tokensInfo.find(tokenInfo => tokenInfo.collection_id === item.collection_id);
        const hasToken = tokenInfo !== undefined;

        if (hasToken && (item.type === 'image'))
            return {state: AccessState.TIERED, tier: {name: 'pictoright', maxSize: 450}};

        if (hasToken)
            return {state: AccessState.OPEN};

        return {state: AccessState.CLOSED};
    }

    return {state: AccessState.CLOSED};
}

module.exports = hasAccess;
