import dayjs from 'dayjs';

import {AccessParams} from '../../lib/ServiceTypes.js';
import {AccessState, Access} from '../../lib/Security.js';
import {getRootItemByCollectionId} from '../../lib/Item.js';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
    if (item.collection_id === null || item.type === 'metadata')
        return {state: AccessState.OPEN};

    const rootItem = await getRootItemByCollectionId(item);
    const accessDate = rootItem?.niod?.accessDate;

    if (!accessDate)
        return {state: AccessState.OPEN};

    if (dayjs().isAfter(dayjs(accessDate)))
        return {state: AccessState.OPEN};

    return {state: AccessState.CLOSED};
}
