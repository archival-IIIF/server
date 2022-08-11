import {AccessParams} from '../../lib/Service.js';
import {getRootItemByCollectionId} from '../../lib/Item.js';
import {AccessState, isIpInRange, hasToken, Access} from '../../lib/Security.js';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
    if (item.collection_id === null || item.type === 'metadata')
        return {state: AccessState.OPEN};

    const rootItem = await getRootItemByCollectionId(item);
    if (!rootItem)
        return {state: AccessState.CLOSED};

    const type = rootItem.iish.type;
    const accessCode = rootItem.iish.access || 'closed';

    if (accessCode === 'open')
        return {state: AccessState.OPEN};

    if (accessCode === 'restricted' && type === 'ead') {
        if (await hasToken(rootItem, identities))
            return {state: AccessState.OPEN};

        if ((rootItem?.id.startsWith('ARCH00293') || rootItem?.id.startsWith('ARCH00393')
                || rootItem?.id.startsWith('COLL00146'))
            && ip && isIpInRange(ip))
            return {state: AccessState.OPEN};

        return {state: AccessState.CLOSED};
    }

    if (accessCode === 'restricted' && type === 'marcxml') {
        if (item.type !== 'image' || (ip && isIpInRange(ip)) || await hasToken(rootItem, identities))
            return {state: AccessState.OPEN};

        return {state: AccessState.TIERED, tier: {name: accessCode, maxSize: 1500}};
    }

    if (accessCode === 'minimal' || accessCode === 'pictoright') {
        if (item.type !== 'image' || (ip && isIpInRange(ip)) || await hasToken(rootItem, identities))
            return {state: AccessState.OPEN};

        return {state: AccessState.TIERED, tier: {name: accessCode, maxSize: 450}};
    }

    if (type === 'marcxml' && ((ip && isIpInRange(ip)) || await hasToken(rootItem, identities)))
        return {state: AccessState.OPEN};

    return {state: AccessState.CLOSED};
}
