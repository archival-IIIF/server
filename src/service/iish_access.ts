import {AccessParams} from '../lib/Service';
import {getRootItemByCollectionId} from '../lib/Item';
import {AccessState, isIpInRange, hasToken, Access} from '../lib/Security';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
    if (item.collection_id === null)
        return {state: AccessState.OPEN};

    const parent = await getRootItemByCollectionId(item.collection_id);
    const type = (parent && parent.iish && parent.iish.type) ? parent.iish.type : null;
    const accessCode = (parent && parent.iish && parent.iish.access) ? parent.iish.access : 'closed';

    if (accessCode === 'open')
        return {state: AccessState.OPEN};

    if (accessCode === 'restricted' && type === 'ead') {
        if (await hasToken(item, identities))
            return {state: AccessState.OPEN};

        return {state: AccessState.CLOSED};
    }

    if (accessCode === 'restricted' && type === 'marcxml') {
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

    if ((type === 'marcxml') && ((ip && isIpInRange(ip)) || await hasToken(item, identities)))
        return {state: AccessState.OPEN};

    return {state: AccessState.CLOSED};
}
