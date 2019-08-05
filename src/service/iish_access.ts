import {AccessParams} from '../lib/Service';
import {AccessState, isIpInRange, hasToken, Access} from '../lib/Security';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
    if (item.collection_id === null)
        return {state: AccessState.OPEN};

    const accessCode = (item.iish && item.iish.access) ? item.iish.access : 'open';
    if (accessCode === 'open')
        return {state: AccessState.OPEN};

    if (accessCode === 'restricted' && item.iish.type === 'ead') {
        if (await hasToken(item, identities))
            return {state: AccessState.OPEN};

        return {state: AccessState.CLOSED};
    }

    if (accessCode === 'restricted' && item.iish.type === 'marcxml') {
        if ((ip && isIpInRange(ip)) || await hasToken(item, identities))
            return {state: AccessState.OPEN};

        if (item.type === 'image')
            return {state: AccessState.TIERED, tier: {name: accessCode, maxSize: 1500}};

        return {state: AccessState.CLOSED};
    }

    if (accessCode === 'minimal' || accessCode === 'pictoright') {
        if ((ip && isIpInRange(ip)) || await hasToken(item, identities))
            return {state: AccessState.OPEN};

        if (item.type === 'image')
            return {state: AccessState.TIERED, tier: {name: accessCode, maxSize: 450}};

        return {state: AccessState.CLOSED};
    }

    if ((item.iish.type === 'marcxml') && ((ip && isIpInRange(ip)) || await hasToken(item, identities)))
        return {state: AccessState.OPEN};

    return {state: AccessState.CLOSED};
}
