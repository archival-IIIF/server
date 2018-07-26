if (process.env.NODE_ENV !== 'production')
    require('dotenv').load();

module.exports = {
    env: process.env.NODE_ENV,
    logo: process.env.IIIF_SERVER_LOGO,
    universalViewerPath: process.env.IIIF_SERVER_UNIVERSAL_VIEWER_PATH,
    archivalViewerPath: process.env.IIIF_SERVER_ARCHIVAL_VIEWER_PATH,
    imageServerUrl: process.env.IIIF_SERVER_IMAGE_SERVER_URL,

    cacheDisabled: (() => {
        const cacheDiasbled = process.env.IIIF_SERVER_CACHE_DISABLED;
        return (cacheDiasbled && (cacheDiasbled.toLowerCase() === 'true' || cacheDiasbled === '1'));
    })(),

    services: (() => {
        if (!process.env.IIIF_SERVER_SERVICES)
            throw new Error("services is not defined");
        return process.env.IIIF_SERVER_SERVICES;
    })(),

    accessToken: (() => {
        if (!process.env.IIIF_SERVER_ACCESS_TOKEN)
            throw new Error("accessToken is not defined");
        return process.env.IIIF_SERVER_ACCESS_TOKEN;
    })(),

    port: (() => {
        const port = parseInt(process.env.IIIF_SERVER_PORT);
        return (port >= 0) ? port : 3333;
    })(),

    logLevel: (() => {
        return process.env.IIIF_SERVER_LOG_LEVEL ? process.env.IIIF_SERVER_LOG_LEVEL : 'debug';
    })(),

    baseUrl: (() => {
        if (!process.env.IIIF_SERVER_BASE_URL)
            throw new Error("base url is not defined");
        return process.env.IIIF_SERVER_BASE_URL;
    })(),

    dataPath: (() => {
        if (!process.env.IIIF_SERVER_DATA_PATH)
            throw new Error("data path is not defined");
        return process.env.IIIF_SERVER_DATA_PATH;
    })(),

    database: (() => {
        const host = process.env.IIIF_SERVER_DATABASE_HOST
            ? process.env.IIIF_SERVER_DATABASE_HOST : 'localhost';
        const port = parseInt(process.env.IIIF_SERVER_DATABASE_PORT) > 0
            ? parseInt(process.env.IIIF_SERVER_DATABASE_PORT) : 5432;
        const user = process.env.IIIF_SERVER_DATABASE_USER
            ? process.env.IIIF_SERVER_DATABASE_USER : 'pgadmin';
        const password = process.env.IIIF_SERVER_DATABASE_PASSWORD
            ? process.env.IIIF_SERVER_DATABASE_PASSWORD : 'pgadmin';
        const database = process.env.IIIF_SERVER_DATABASE_DB
            ? process.env.IIIF_SERVER_DATABASE_DB : 'iiif-server';

        return {host, port, user, password, database};
    })(),

    redis: (() => {
        const host = process.env.IIIF_SERVER_REDIS_HOST
            ? process.env.IIIF_SERVER_REDIS_HOST : 'localhost';
        const port = parseInt(process.env.IIIF_SERVER_REDIS_PORT) > 0
            ? parseInt(process.env.IIIF_SERVER_REDIS_PORT) : 6379;

        return {host, port};
    })()
};


