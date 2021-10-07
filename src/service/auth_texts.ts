import {AuthTextsParams} from '../lib/Service';
import {AuthTextsByType} from './util/types';
import {isAuthenticationEnabled, isExternalEnabled, isIpAccessEnabled, isLoginEnabled} from '../lib/Security';

const logout = {
    label: 'Logout'
};

const login = {
    label: 'Login with code to gain access',
    header: 'Login with code to gain access',
    description: 'You are required to login with a code to see this item.',
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
        if (isLoginEnabled())
            authTexts = {...authTexts, logout, login};

        if (isExternalEnabled() || isIpAccessEnabled())
            authTexts = {...authTexts, external};
    }

    return authTexts;
}
