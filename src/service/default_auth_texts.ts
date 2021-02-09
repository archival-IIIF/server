import {AuthTextsParams} from '../lib/Service';
import {AuthTextsByType} from './util/types';

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
    failureHeader: 'Authentication failed',
    failureDescription: 'This item can only be requested in certain locations.',
};

export default async function getAuthTexts({item}: AuthTextsParams): Promise<AuthTextsByType> {
    return {logout, external, login};
}
