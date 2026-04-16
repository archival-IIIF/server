import dayjs from 'dayjs';

import {AccessState} from '../../lib/Security.ts';
import {getRootItemByCollectionId} from '../../lib/Item.ts';

import type {Access} from '../../lib/Security.ts';
import type {AccessParams} from '../../lib/ServiceTypes.ts';

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
