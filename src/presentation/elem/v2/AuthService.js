const Base = require('./Base');

class AuthService extends Base {
    constructor(id, profile, context) {
        super(id, null, null);
        this.profile = profile;
        if (context) this['@context'] = context;
    }

    setAuthTexts(authTexts) {
        if (authTexts.label) this.label = authTexts.label;
        if (authTexts.header) this.header = authTexts.header;
        if (authTexts.description) this.description = authTexts.description;
        if (authTexts.confirmLabel) this.confirmLabel = authTexts.confirmLabel;
        if (authTexts.failureHeader) this.failureHeader = authTexts.failureHeader;
        if (authTexts.failureDescription) this.failureDescription = authTexts.failureDescription;
    }

    static getAuthenticationService(prefixAuthUrl, authTexts, type = 'login') {
        let service = null;
        switch (type) {
            case 'login':
                service = new AuthService(`${prefixAuthUrl}/login`,
                    'http://iiif.io/api/auth/1/login', 'http://iiif.io/api/auth/1/context.json');
                break;
            case 'external':
                service = new AuthService(null,
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

    static getAccessTokenService(prefixAuthUrl) {
        return new AuthService(`${prefixAuthUrl}/token`, 'http://iiif.io/api/auth/1/token', null);
    }

    static getLogoutService(prefixAuthUrl, authTexts) {
        const service = new AuthService(`${prefixAuthUrl}/logout`, 'http://iiif.io/api/auth/1/logout', null);
        service.setAuthTexts(authTexts.logout);
        return service;
    }
}

module.exports = AuthService;
