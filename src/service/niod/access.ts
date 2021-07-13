import moment from 'moment';

import {AccessParams} from '../../lib/Service';
import {AccessState, Access} from '../../lib/Security';
import {getRootItemByCollectionId} from '../../lib/Item';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
    if (item.collection_id === null || item.type === 'metadata')
        return {state: AccessState.OPEN};

    const rootItem = await getRootItemByCollectionId(item);
    const accessDate = rootItem?.niod?.accessDate;

    if (!accessDate)
        return {state: AccessState.OPEN};

    if (moment().isAfter(moment(accessDate)))
        return {state: AccessState.OPEN};

    return {state: AccessState.CLOSED};
}
