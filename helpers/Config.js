if (process.env.NODE_ENV !== 'production')
    require('dotenv').load();

module.exports = {
    imageServerUrl: (() => {
        return process.env.IIIF_SERVER_IMAGE_SERVER_URL;
    })(),

    logo: (() => {
        return process.env.IIIF_SERVER_LOGO;
    })(),

    port: (() => {
        const port = parseInt(process.env.IIIF_SERVER_PORT);
        return (port >= 0) ? port : 3333;
    })(),

    defaultLang: (() => {
        if (!process.env.IIIF_SERVER_DEFAULT_LANG)
            throw "defaultLang is not defined";
        return process.env.IIIF_SERVER_DEFAULT_LANG;
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

    baseUrl: (() => {
        if (!process.env.IIIF_BASE_URL)
            throw "base url is not defined";
        return process.env.IIIF_BASE_URL;
    })(),

    publicFolder: (() => {
        return process.env.IIIF_SERVER_PUBLIC_FOLDER;
    })()
};


