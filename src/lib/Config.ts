if (process.env.NODE_ENV === 'test')
    require('dotenv').config({path: `${__dirname}/../../.test.env`});
else if (process.env.NODE_ENV !== 'production')
    require('dotenv').config();

export interface Config {
    env?: string;
    appInstance?: string;
    attribution?: string;
    universalViewerPath?: string;
    archivalViewerPath?: string;
    universalViewerConfigPath?: string;
    hotFolderPath?: string;
    hotFolderPattern?: string;
    metadataOaiUrl?: string;
    metadataSrwUrl?: string;
    logoRelativePath?: string;
    elasticSearchUser?: string;
    elasticSearchPassword?: string;
    imageServerUrl: string;
    imageServerName: 'loris' | 'sharp';
    logoDimensions?: [number, number],
    imageTierSeparator: string;
    cacheDisabled: boolean;
    maxTasksPerWorker: number;
    services: string[];
    secret: string;
    accessToken: string;
    port: number;
    logLevel: string;
    baseUrl: string;
    dataRootPath: string;
    collectionsRelativePath: string;
    derivativeRelativePath: string;
    internalIpAddresses: string[];
    loginDisabled: boolean;
    elasticSearchUrl: string;
    redis: null | {
        host: string;
        port: number;
    };
}

const config: Config = {
    env: process.env.NODE_ENV,
    appInstance: process.env.NODE_APP_INSTANCE,
    attribution: process.env.IIIF_SERVER_ATTRIBUTION,
    universalViewerPath: process.env.IIIF_SERVER_UNIVERSAL_VIEWER_PATH,
    archivalViewerPath: process.env.IIIF_SERVER_ARCHIVAL_VIEWER_PATH,
    universalViewerConfigPath: process.env.IIIF_SERVER_UNIVERSAL_VIEWER_CONFIG_PATH,
    hotFolderPath: process.env.IIIF_SERVER_HOT_FOLDER_PATH,
    hotFolderPattern: process.env.IIIF_SERVER_HOT_FOLDER_PATTERN,
    metadataOaiUrl: process.env.IIIF_SERVER_METADATA_OAI_URL,
    metadataSrwUrl: process.env.IIIF_SERVER_METADATA_SRW_URL,
    logoRelativePath: process.env.IIIF_SERVER_LOGO_REL_PATH,
    elasticSearchUser: process.env.IIIF_SERVER_ELASTICSEARCH_USER,
    elasticSearchPassword: process.env.IIIF_SERVER_ELASTICSEARCH_PASSWORD,

    imageServerUrl: (() => {
        if (!process.env.IIIF_SERVER_IMAGE_SERVER_URL || (process.env.IIIF_SERVER_IMAGE_SERVER_URL === 'null'))
            throw new Error('Image server url is not defined');
        return process.env.IIIF_SERVER_IMAGE_SERVER_URL;
    })(),

    imageServerName: (() => {
        if (!process.env.IIIF_SERVER_IMAGE_SERVER_NAME ||
            !['loris', 'sharp'].includes(process.env.IIIF_SERVER_IMAGE_SERVER_NAME))
            throw new Error('Image server name should either be \'loris\' or \'sharp\'');
        return process.env.IIIF_SERVER_IMAGE_SERVER_NAME as 'loris' | 'sharp';
    })(),

    logoDimensions: (() => {
        if (!process.env.IIIF_SERVER_LOGO_DIM || (process.env.IIIF_SERVER_LOGO_DIM === 'null'))
            return undefined;

        const dimensions = process.env.IIIF_SERVER_LOGO_DIM.split(':');
        return [parseInt(dimensions[0]), parseInt(dimensions[1])] as [number, number];
    })(),

    imageTierSeparator: (() => {
        if (!process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR || (process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR === 'null'))
            throw new Error('Image tier separator is not defined');
        return process.env.IIIF_SERVER_IMAGE_TIER_SEPARATOR;
    })(),

    cacheDisabled: (() => {
        const cacheDisabled = process.env.IIIF_SERVER_CACHE_DISABLED;
        return (cacheDisabled !== undefined && (cacheDisabled.toLowerCase() === 'true' || cacheDisabled === '1'));
    })(),

    maxTasksPerWorker: (() => {
        const maxTasksPerWorker = process.env.IIIF_SERVER_MAX_TASKS_PER_WORKER
            ? parseInt(process.env.IIIF_SERVER_MAX_TASKS_PER_WORKER) : 0;
        return (maxTasksPerWorker >= 0) ? maxTasksPerWorker : 5;
    })(),

    services: (() => {
        if (!process.env.IIIF_SERVER_SERVICES || (process.env.IIIF_SERVER_SERVICES === 'null'))
            throw new Error('Services to run are not defined');
        return process.env.IIIF_SERVER_SERVICES.split(',');
    })(),

    secret: (() => {
        if (!process.env.IIIF_SERVER_SECRET || (process.env.IIIF_SERVER_SECRET === 'null'))
            throw new Error('Secret is not defined');
        return process.env.IIIF_SERVER_SECRET;
    })(),

    accessToken: (() => {
        if (!process.env.IIIF_SERVER_ACCESS_TOKEN || (process.env.IIIF_SERVER_ACCESS_TOKEN === 'null'))
            throw new Error('The access token is not defined');
        return process.env.IIIF_SERVER_ACCESS_TOKEN;
    })(),

    port: (() => {
        const port = process.env.IIIF_SERVER_PORT ? parseInt(process.env.IIIF_SERVER_PORT) : 0;
        return (port >= 0) ? port : 3333;
    })(),

    logLevel: (() => {
        return (process.env.IIIF_SERVER_LOG_LEVEL && (process.env.IIIF_SERVER_LOG_LEVEL !== 'null'))
            ? process.env.IIIF_SERVER_LOG_LEVEL : 'debug';
    })(),

    baseUrl: (() => {
        if (!process.env.IIIF_SERVER_BASE_URL || (process.env.IIIF_SERVER_BASE_URL === 'null'))
            throw new Error('The base url is not defined');
        return process.env.IIIF_SERVER_BASE_URL;
    })(),

    dataRootPath: (() => {
        if (!process.env.IIIF_SERVER_DATA_ROOT_PATH || (process.env.IIIF_SERVER_DATA_ROOT_PATH === 'null'))
            throw new Error('The data root path is not defined');
        return process.env.IIIF_SERVER_DATA_ROOT_PATH;
    })(),

    collectionsRelativePath: (() => {
        if (!process.env.IIIF_SERVER_COLLECTIONS_REL_PATH || (process.env.IIIF_SERVER_COLLECTIONS_REL_PATH === 'null'))
            throw new Error('The collections relative path is not defined');
        return process.env.IIIF_SERVER_COLLECTIONS_REL_PATH;
    })(),

    derivativeRelativePath: (() => {
        if (!process.env.IIIF_SERVER_DERIVATIVE_REL_PATH || (process.env.IIIF_SERVER_DERIVATIVE_REL_PATH === 'null'))
            throw new Error('The derivative relative path is not defined');
        return process.env.IIIF_SERVER_DERIVATIVE_REL_PATH;
    })(),

    internalIpAddresses: (() => {
        if (!process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES || (process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES === 'null'))
            return [];
        return process.env.IIIF_SERVER_INTERNAL_IP_ADDRESSES.split(',');
    })(),

    loginDisabled: (() => {
        const loginDisabled = process.env.IIIF_SERVER_LOGIN_DISABLED;
        return ((loginDisabled !== undefined) && (loginDisabled.toLowerCase() === 'true' || loginDisabled === '1'));
    })(),

    elasticSearchUrl: (() => {
        if (!process.env.IIIF_SERVER_ELASTICSEARCH_URL || (process.env.IIIF_SERVER_ELASTICSEARCH_URL === 'null'))
            throw new Error('The ElasticSearch URL is not defined');
        return process.env.IIIF_SERVER_ELASTICSEARCH_URL;
    })(),

    redis: (() => {
        const redisDisabled = process.env.IIIF_SERVER_REDIS_DISABLED;
        if (redisDisabled && (redisDisabled.toLowerCase() === 'true' || redisDisabled === '1'))
            return null;

        const host = (process.env.IIIF_SERVER_REDIS_HOST && (process.env.IIIF_SERVER_REDIS_HOST !== 'null'))
            ? process.env.IIIF_SERVER_REDIS_HOST : 'localhost';
        const port = process.env.IIIF_SERVER_REDIS_PORT && parseInt(process.env.IIIF_SERVER_REDIS_PORT) > 0
            ? parseInt(process.env.IIIF_SERVER_REDIS_PORT) : 6379;

        return {host, port};
    })()
};

// For test purposes
export function setConfig<P extends keyof Config, V extends Config[P]>(property: P, value: V): void {
    if (config.env === 'test')
        config[property] = value;
}

export default config;
