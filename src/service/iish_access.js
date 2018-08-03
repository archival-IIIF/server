const {isIpInRange, checkTokenDb} = require('../lib/Security');

async function hasAccess({item, ip, identities}) {
    if (!ip || !identities || (identities.length === 0))
        return false;

    if (!isIpInRange(ip))
        return false;

    const tokensInfo = await checkTokenDb(identities);
    const tokenInfo = tokensInfo.find(tokenInfo => tokenInfo.container_id === item.container_id);
    const hasToken = tokenInfo !== undefined;

    if (hasToken && (item.type === 'image'))
        return {name: 'pictoright', maxSize: 450};

    return hasToken;
}

module.exports = hasAccess;
