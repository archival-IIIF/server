import {AccessParams} from '../../lib/Service';
import {getRootItemByCollectionId} from '../../lib/Item';
import {AccessState, isIpInRange, hasToken, Access} from '../../lib/Security';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
    if (item.collection_id === null || item.type === 'metadata')
        return {state: AccessState.OPEN};

    const rootItem = await getRootItemByCollectionId(item);
    const type = rootItem?.iish?.type;
    const accessCode = rootItem?.iish?.access || 'closed';

    if (accessCode === 'open')
        return {state: AccessState.OPEN};

    if (accessCode === 'restricted' && type === 'ead') {
        if (await hasToken(item, identities))
            return {state: AccessState.OPEN};

        if ((rootItem?.id.startsWith('ARCH00293') || rootItem?.id.startsWith('ARCH00393'))
            && ip && isIpInRange(ip))
            return {state: AccessState.OPEN};

        return {state: AccessState.CLOSED};
    }

    if (accessCode === 'restricted' && type === 'marcxml') {
        if (item.type !== 'image' || (ip && isIpInRange(ip)) || await hasToken(item, identities))
            return {state: AccessState.OPEN};

        return {state: AccessState.TIERED, tier: {name: accessCode, maxSize: 1500}};
    }

    if (accessCode === 'minimal' || accessCode === 'pictoright') {
        if (item.type !== 'image' || (ip && isIpInRange(ip)) || await hasToken(item, identities))
            return {state: AccessState.OPEN};

        return {state: AccessState.TIERED, tier: {name: accessCode, maxSize: 450}};
    }

    if (type === 'marcxml' && ((ip && isIpInRange(ip)) || await hasToken(item, identities)))
        return {state: AccessState.OPEN};

    return {state: AccessState.CLOSED};
}
