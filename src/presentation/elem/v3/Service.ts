export default class Service {
    static IMAGE_SERVICE_1 = 'ImageService1';
    static IMAGE_SERVICE_2 = 'ImageService2';
    static SEARCH_SERVICE_1 = 'SearchService1';
    static AUTOCOMPLETE_SERVICE_1 = 'AutoCompleteService1';
    static AUTH_COOKIE_SERVICE_1 = 'AuthCookieService1';
    static AUTH_TOKEN_SERVICE_1 = 'AuthTokenService1';
    static AUTH_LOGOUT_SERVICE_1 = 'AuthLogoutService1';

    static OLD_SERVICES = [
        Service.IMAGE_SERVICE_1, Service.IMAGE_SERVICE_2, Service.SEARCH_SERVICE_1, Service.AUTOCOMPLETE_SERVICE_1,
        Service.AUTH_COOKIE_SERVICE_1, Service.AUTH_TOKEN_SERVICE_1, Service.AUTH_LOGOUT_SERVICE_1
    ];

    id?: string;
    type?: string;

    '@id'?: string;
    '@type'?: string;

    profile: string;

    constructor(id: string, type: string, profile: string) {
        if (Service.OLD_SERVICES.includes(type))
            this['@id'] = id;
        else
            this['id'] = id;

        if (Service.OLD_SERVICES.includes(type))
            this['@type'] = type;
        else
            this['type'] = type;

        this.profile = profile;
    }
}
