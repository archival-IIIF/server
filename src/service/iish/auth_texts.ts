import {AuthTextsParams} from '../../lib/Service';
import {getRootItemByCollectionId} from '../../lib/Item';
import {
    isAuthenticationEnabled,
    isExternalEnabled,
    isIpAccessEnabled,
    isLoginEnabled
} from '../../lib/Security';

import {AuthTextsByType} from '../util/types';

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
    failureHeader: 'Access restricted',
    failureDescription: 'Unfortunately access to this record is restricted.',
};

export default async function getAuthTexts({item}: AuthTextsParams): Promise<AuthTextsByType> {
    let authTexts = {};
    if (isAuthenticationEnabled()) {
        if (item.collection_id === null || item.type === 'metadata')
            return authTexts;

        const rootItem = await getRootItemByCollectionId(item);
        const metadataType = rootItem?.iish?.type;

        if (isLoginEnabled())
            authTexts = {...authTexts, logout, login};

        if ((isExternalEnabled() || isIpAccessEnabled()) && (metadataType === 'marcxml'))
            authTexts = {...authTexts, external};
    }

    return authTexts;
}
