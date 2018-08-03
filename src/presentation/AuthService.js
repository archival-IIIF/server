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

    static getAuthenticationService(prefixAuthUrl, type = 'login') {
        switch (type) {
            case 'login':
                const loginService = new AuthService(`${prefixAuthUrl}/login`,
                    'http://iiif.io/api/auth/1/login', 'http://iiif.io/api/auth/1/context.json');
                loginService.setAuthTexts({
                    label: "Login to Example Institution",
                    header: "Please Log In",
                    description: "Example Institution requires that you log in with your example account to view this content.",
                    confirmLabel: "Login",
                    failureHeader: "Authentication Failed",
                    failureDescription: "<a href=\"http://example.org/policy\">Access Policy</a>",
                });
                loginService.setService(AuthService.getAccessTokenService(prefixAuthUrl));
                return loginService;
            case 'external':
                const externalService = new AuthService(null,
                    'http://iiif.io/api/auth/1/external', 'http://iiif.io/api/auth/1/context.json');
                externalService.setAuthTexts({
                    failureHeader: "Authentication Failed",
                    failureDescription: "<a href=\"http://example.org/policy\">Access Policy</a>",
                });
                externalService.setService(AuthService.getAccessTokenService(prefixAuthUrl));
                return externalService;
            default:
                return null;
        }
    }

    static getAccessTokenService(prefixAuthUrl) {
        return new AuthService(`${prefixAuthUrl}/token`, 'http://iiif.io/api/auth/1/token', null);
    }
}

module.exports = AuthService;
