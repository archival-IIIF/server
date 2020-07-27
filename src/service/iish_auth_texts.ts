import {AuthTextsParams} from '../lib/Service';
import {getRootItemByCollectionId} from '../lib/Item';

import {AuthTextsByType} from './util/types';

const logout = {
    label: 'Logout'
};

const login = {
    label: 'Login with code to gain access',
    header: 'Login with code to gain access',
    description: 'The IISH requires that you login with a code to see this collection.',
    confirmLabel: 'Login with code',
    failureHeader: 'Authentication failed',
    failureDescription: 'The code is not valid!',
};

const external = {
    label: 'Access',
    header: 'Access',
    failureHeader: 'Authentication failed',
    failureDescription: 'This collection can only be requested in the reading room of the IISH.',
};

export default async function getAuthTexts({item}: AuthTextsParams): Promise<AuthTextsByType> {
    const rootItem = await getRootItemByCollectionId(item);
    const metadataType = rootItem?.iish?.type;

    if (metadataType === 'marcxml')
        return {logout, external, login};

    return {logout, login};
}
