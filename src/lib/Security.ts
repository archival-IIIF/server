import * as moment from 'moment';
// @ts-ignore
import * as rangeCheck from 'range_check';
import * as uuid from 'uuid/v4';
import {Context} from 'koa';

import {getClient} from './Redis';
import config from './Config';
import logger from './Logger';
import getEsClient from './ElasticSearch';
import {runTaskWithResponse} from './Task';
import {Item} from './ItemInterfaces';

import {AuthTextsByType} from '../service/util/types';
import {AccessParams, AuthTextsParams} from './Service';

export type Access =
    { state: AccessState.OPEN | AccessState.CLOSED, tier?: undefined } |
    { state: AccessState.TIERED, tier: AccessTier };

export interface AccessTier {
    name: string;
    maxSize: number;
}

export interface Token {
    token: string;
    collection_id: string | null;
    from: Date | null;
    to: Date | null;
}

const isLoginEnabled = !config.loginDisabled;
const isExternalEnabled = config.internalIpAddresses.length > 0;
const isAuthenticationEnabled = isLoginEnabled || isExternalEnabled;

export const enabledAuthServices: ('login' | 'external')[] = [];
if (isLoginEnabled)
    enabledAuthServices.push('login');
if (isExternalEnabled)
    enabledAuthServices.push('external');

export enum AccessState {
    OPEN = 'open',
    CLOSED = 'closed',
    TIERED = 'tiered'
}

export async function hasAccess(ctx: Context, item: Item, acceptToken = false): Promise<Access> {
    if (hasAdminAccess(ctx))
        return {state: AccessState.OPEN};

    if (isAuthenticationEnabled) {
        const ip = ctx.ip;
        const accessId = await getAccessIdFromRequest(ctx, acceptToken);
        const accessIdInfo = await getIdentitiesAndTokensForAccessId(accessId);
        const identities = accessIdInfo ? accessIdInfo.identities : [];

        if (accessId && identities.length > 0)
            logger.debug('Determining access with an access id and matching identities');
        else if (accessId)
            logger.debug('Determining access with an access id but no matching identities');
        else
            logger.debug('Determining access with no access id and no identities');

        return await runTaskWithResponse<AccessParams, Access>('access', {item, ip, identities});
    }

    return {state: AccessState.OPEN};
}

export function hasAdminAccess(ctx: Context): boolean {
    if (ctx.request.body.access_token && (ctx.request.body.access_token.toLowerCase() === config.accessToken))
        return true;

    if (ctx.query.access_token && (ctx.query.access_token.toLowerCase() === config.accessToken))
        return true;

    return (ctx.headers.hasOwnProperty('authorization')
        && (ctx.headers.authorization.replace('Bearer', '').trim().toLowerCase() === config.accessToken));
}

export async function requiresAuthentication(item: Item): Promise<boolean> {
    if (isAuthenticationEnabled) {
        const access = await runTaskWithResponse<AccessParams, Access>('access', {item});
        return access.state !== AccessState.OPEN;
    }

    return false;
}

export async function getAuthTexts(item: Item): Promise<AuthTextsByType> {
    return await runTaskWithResponse<AuthTextsParams, AuthTextsByType>('auth-texts', {item});
}

export function isIpInRange(ip: string): boolean {
    if (isExternalEnabled) {
        const foundMatch = config.internalIpAddresses.find(ipRange => rangeCheck.inRange(ip, ipRange));
        return foundMatch !== undefined;
    }
    return true;
}

export async function checkTokenDb(tokens: string[]): Promise<Token[]> {
    try {
        const response = await getEsClient().search<Token>({
            index: 'tokens',
            size: 100,
            body: {
                query: {
                    terms: {'token': tokens}
                }
            },
        });

        const tokensInfo = response.hits.hits.map(hit => hit._source);
        return tokensInfo.filter(tokenInfo => {
            if (tokenInfo.from && tokenInfo.to && !moment().isBetween(moment(tokenInfo.from), moment(tokenInfo.to)))
                return false;

            if (tokenInfo.from && !moment().isAfter(moment(tokenInfo.from)))
                return false;

            return !(tokenInfo.to && !moment().isBefore(moment(tokenInfo.to)));
        });
    }
    catch (err) {
        return [];
    }
}

async function getIdentitiesAndTokensForAccessId(acccesId: string | null): Promise<{ identities: string[]; token: string; } | null> {
    const client = getClient();
    if (!client)
        throw new Error('Redis is required for authentication!');

    const accessIdInfo = await client.get(`access-id:${acccesId}`);
    if (accessIdInfo)
        return JSON.parse(accessIdInfo);
    return null;
}

export async function setAccessIdForIdentity(identity: string, accessId: string | null): Promise<string> {
    const client = getClient();
    if (!client)
        throw new Error('Redis is required for authentication!');

    const accessIdInfo = accessId ? await getIdentitiesAndTokensForAccessId(accessId) : null;
    const identities = accessIdInfo ? accessIdInfo.identities : [];
    const token = accessIdInfo ? accessIdInfo.token : null;

    accessId = accessId || uuid();

    if (!identities.includes(identity)) {
        identities.push(identity);
        await client.set(`access-id:${accessId}`, JSON.stringify({identities, token}), ['EX', 86400]);
    }

    return accessId;
}

export async function setAccessTokenForAccessId(accessId: string): Promise<string | null> {
    const client = getClient();
    if (!client)
        throw new Error('Redis is required for authentication!');

    const accessIdInfo = await getIdentitiesAndTokensForAccessId(accessId);
    if (accessIdInfo) {
        const identities = accessIdInfo.identities;
        const token = accessIdInfo.token || uuid();

        if (!accessIdInfo.token) {
            await client.set(`access-token:${token}`, accessId, ['EX', 86400]);
            await client.set(`access-id:${accessId}`, JSON.stringify({identities, token}), ['EX', 86400]);
        }

        return token;
    }

    return null;
}

async function getAccessIdForAccessToken(accessToken: string): Promise<string | null> {
    const client = getClient();
    if (!client)
        throw new Error('Redis is required for authentication!');

    return await client.get(`access-token:${accessToken}`);
}

export async function getAccessIdFromRequest(ctx: Context, acceptToken = false): Promise<string | null> {
    if (acceptToken && ctx.headers.hasOwnProperty('authorization')) {
        logger.debug('Found token in header for current request');

        const accessToken = ctx.headers.authorization.replace('Bearer', '').trim();
        return await getAccessIdForAccessToken(accessToken);
    }

    const accessCookie = ctx.cookies.get('access');
    if (accessCookie)
        logger.debug('Found access cookie for current request');

    return accessCookie;
}

export async function removeAccessIdFromRequest(ctx: Context): Promise<void> {
    const client = getClient();
    if (!client)
        throw new Error('Redis is required for authentication!');

    const accessId = ctx.cookies.get('access');
    if (accessId) {
        const accessIdInfo = await getIdentitiesAndTokensForAccessId(accessId);
        if (accessIdInfo) {
            await client.del(`access-id:${accessId}`);

            if (accessIdInfo.token)
                await client.del(`access-token:${accessIdInfo.token}`);
        }
    }
}
