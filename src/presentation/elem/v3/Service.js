class Service {
    constructor(id, type, profile) {
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

Service.IMAGE_SERVICE_1 = 'ImageService1';
Service.IMAGE_SERVICE_2 = 'ImageService2';
Service.SEARCH_SERVICE_1 = 'SearchService1';
Service.AUTOCOMPLETE_SERVICE_1 = 'AutoCompleteService1';
Service.AUTH_COOKIE_SERVICE_1 = 'AuthCookieService1';
Service.AUTH_TOKEN_SERVICE_1 = 'AuthTokenService1';
Service.AUTH_LOGOUT_SERVICE_1 = 'AuthLogoutService1';

Service.OLD_SERVICES = [
    Service.IMAGE_SERVICE_1, Service.IMAGE_SERVICE_2, Service.SEARCH_SERVICE_1, Service.AUTOCOMPLETE_SERVICE_1,
    Service.AUTH_COOKIE_SERVICE_1, Service.AUTH_TOKEN_SERVICE_1, Service.AUTH_LOGOUT_SERVICE_1
];

module.exports = Service;
