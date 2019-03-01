import {AuthTextsParams} from '../lib/Service';
import {AuthTextsByType} from './util/types';

export default async function getAuthTexts({item}: AuthTextsParams): Promise<AuthTextsByType> {
    return {
        logout: {
            label: 'Logout'
        },
        external: {
            failureHeader: 'Authentication Failed',
            failureDescription: 'This collection can only be requested in the reading room of the IISH.',
        },
        login: {
            label: 'Provide code for access',
            header: 'Provide code for access',
            description: 'The IISH requires that you provide a code in order to see this collection.',
            confirmLabel: 'Login with code',
            failureHeader: 'Authentication failed',
            failureDescription: 'The code provided is not valid!',
        }
    }
}
