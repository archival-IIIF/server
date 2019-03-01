import Base from './Base';
import {AuthTextsByType} from '../../../service/util/types';

type AuthType = 'login' | 'external' | 'logout';

export interface AuthTexts {
    label?: string;
    header?: string;
    description?: string;
    confirmLabel?: string;
    failureHeader?: string;
    failureDescription?: string;
}

export default class AuthService extends Base {
    profile: string;
    header?: string;
    confirmLabel?: string;
    failureHeader?: string;
    failureDescription?: string;

    constructor(id: string | undefined, profile: string, context?: string) {
        super(id);
        this.profile = profile;
        if (context) this['@context'] = context;
    }

    setAuthTexts(authTexts: AuthTexts) {
        if (authTexts.label) this.label = authTexts.label;
        if (authTexts.header) this.header = authTexts.header;
        if (authTexts.description) this.description = authTexts.description;
        if (authTexts.confirmLabel) this.confirmLabel = authTexts.confirmLabel;
        if (authTexts.failureHeader) this.failureHeader = authTexts.failureHeader;
        if (authTexts.failureDescription) this.failureDescription = authTexts.failureDescription;
    }

    static getAuthenticationService(prefixAuthUrl: string, authTexts: AuthTextsByType,
                                    type: AuthType = 'login'): AuthService | null {
        let service = null;
        switch (type) {
            case 'login':
                service = new AuthService(`${prefixAuthUrl}/login`,
                    'http://iiif.io/api/auth/1/login', 'http://iiif.io/api/auth/1/context.json');
                break;
            case 'external':
                service = new AuthService(undefined,
                    'http://iiif.io/api/auth/1/external', 'http://iiif.io/api/auth/1/context.json');
                break;
            default:
                return null;
        }

        service.setAuthTexts(authTexts[type]);
        service.setService(AuthService.getAccessTokenService(prefixAuthUrl));

        if (type !== 'external')
            service.setService(AuthService.getLogoutService(prefixAuthUrl, authTexts));

        return service;
    }

    static getAccessTokenService(prefixAuthUrl: string): AuthService {
        return new AuthService(`${prefixAuthUrl}/token`, 'http://iiif.io/api/auth/1/token');
    }

    static getLogoutService(prefixAuthUrl: string, authTexts: { [type: string]: AuthTexts }): AuthService {
        const service = new AuthService(`${prefixAuthUrl}/logout`, 'http://iiif.io/api/auth/1/logout');
        service.setAuthTexts(authTexts.logout);
        return service;
    }
}
