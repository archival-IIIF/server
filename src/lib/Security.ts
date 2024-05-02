import dayjs from 'dayjs';
import {Context} from 'koa';
import {randomUUID} from 'crypto';
import {inRange} from 'range_check';
import {RedisClientType} from 'redis';
import {AccessTier} from '@archival-iiif/presentation-builder/v2';

import config from './Config.js';
import logger from './Logger.js';
import {runLib} from './Task.js';
import {Item} from './ItemInterfaces.js';
import {ExtendedContext} from './Koa.js';
import {getPersistentClient} from './Redis.js';
import {AccessParams, AuthTextsByType, ItemParams} from './ServiceTypes.js';

type AccessTokenBody = Record<'access_token', string | undefined>;

export type Access =
    { state: AccessState.OPEN | AccessState.CLOSED, tier?: undefined } |
    { state: AccessState.TIERED, tier: AccessTier };

export interface Token {
    token: string;
    ids: string[];
    from: Date | null;
    to: Date | null;
}

export const isLoginEnabled = () => config.loginEnabled;
export const isExternalEnabled = () => config.externalEnabled;
export const isIpAccessEnabled = () => config.internalIpAddresses.length > 0;
export const isAuthenticationEnabled = () => isLoginEnabled() || isExternalEnabled() || isIpAccessEnabled();

export enum AccessState {
    OPEN = 'open',
    CLOSED = 'closed',
    TIERED = 'tiered'
}

export async function hasAccess(ctx: ExtendedContext, item: Item, acceptToken = false): Promise<Access> {
    if (hasAdminAccess(ctx))
        return {state: AccessState.OPEN};

    if (!isAuthenticationEnabled()) {
        const access = await runLib<AccessParams, Access>('access', {item});
        logger.debug(`Access for ${item.id} is ${access.state} without authentication enabled`);

        return access;
    }

    const ip = getIpAddress(ctx);
    const accessId = await getAccessIdFromRequest(ctx, acceptToken);
    const accessIdInfo = await getIdentitiesAndTokensForAccessId(accessId);
    const identities = accessIdInfo ? accessIdInfo.identities : [];

    if (accessId && identities.length > 0)
        logger.debug('Determining access with an access id and matching identities');
    else if (accessId)
        logger.debug('Determining access with an access id but no matching identities');
    else
        logger.debug('Determining access with no access id and no identities');

    const access = await runLib<AccessParams, Access>('access', {item, ip, identities});
    logger.debug(`Access for ${item.id} is ${access.state} based on ip ${ip} and ${identities.length} identities`);

    return access;
}

export function hasAdminAccess(ctx: ExtendedContext): boolean {
    if ((ctx.request.body as AccessTokenBody).access_token?.toLowerCase() === config.accessToken)
        return true;

    const accessToken = ctx.queryFirst('access_token');
    if (accessToken && accessToken.toLowerCase() === config.accessToken)
        return true;

    return ctx.headers.authorization?.replace('Bearer', '').trim().toLowerCase() === config.accessToken;
}

export function getIpAddress(ctx: Context): string {
    if (config.ipAddressHeader) {
        const ips = ctx.get(config.ipAddressHeader.toLowerCase());
        if (ips && ips.length > 0) {
            const ip = ips.split(/\s*,\s*/)[0];
            return ip || ctx.ip;
        }
    }

    return ctx.ip;
}

export async function getDefaultAccess(item: Item): Promise<Access> {
    if (isAuthenticationEnabled())
        return runLib<AccessParams, Access>('access', {item});

    return {state: AccessState.OPEN};
}

export async function requiresAuthentication(item: Item): Promise<boolean> {
    const access = await getDefaultAccess(item);
    return access.state !== AccessState.OPEN;
}

export async function getAuthTexts(item: Item): Promise<AuthTextsByType> {
    return runLib<ItemParams, AuthTextsByType>('auth-texts', {item});
}

export function isIpInRange(ip: string): boolean {
    return isIpAccessEnabled() ? inRange(ip, config.internalIpAddresses) : true;
}

export async function hasToken(item: Item, identities: string[]): Promise<boolean> {
    if (isLoginEnabled() || isExternalEnabled()) {
        const tokensInfo = await checkTokenDb(identities);
        const tokenInfo = tokensInfo.find(tokenInfo =>
            tokenInfo.ids.find(id => item.id === id || item.parent_ids.includes(id)));
        return tokenInfo !== undefined;
    }
    return false;
}

export async function checkTokenDb(tokens: string[]): Promise<Token[]> {
    try {
        const tokensInfo = await getClient().mGet(tokens.map(token => `token:${token}`));
        return tokensInfo
            .map(tokensInfo => tokensInfo ? JSON.parse(tokensInfo) : null)
            .filter(tokenInfo => {
                if (!tokenInfo)
                    return false;

                const now = dayjs();
                const from = tokenInfo.from ? dayjs(tokenInfo.from) : null;
                const to = tokenInfo.to ? dayjs(tokenInfo.to) : null;

                if (from && to && !now.isAfter(from) && !now.isBefore(to))
                    return false;
                if (from && !now.isAfter(from))
                    return false;
                return !(to && !now.isBefore(to));
            });
    }
    catch (err) {
        return [];
    }
}

async function getIdentitiesAndTokensForAccessId(accessId: string | null): Promise<{ identities: string[]; token: string; } | null> {
    const accessIdInfo = await getClient().get(`access-id:${accessId}`);
    return accessIdInfo ? JSON.parse(accessIdInfo) : null;
}

export async function setAccessIdForIdentity(identity: string, accessId: string | null = null): Promise<string> {
    const accessIdInfo = accessId ? await getIdentitiesAndTokensForAccessId(accessId) : null;
    const identities = accessIdInfo ? accessIdInfo.identities : [];
    const token = accessIdInfo ? accessIdInfo.token : null;

    accessId = accessId || randomUUID();

    if (!identities.includes(identity)) {
        identities.push(identity);
        await getClient().set(
            `access-id:${accessId}`, JSON.stringify({identities, token}), {EX: config.accessTtl});
    }

    return accessId;
}

export async function setAccessTokenForAccessId(accessId: string): Promise<string | null> {
    const accessIdInfo = await getIdentitiesAndTokensForAccessId(accessId);
    if (accessIdInfo) {
        const identities = accessIdInfo.identities;
        const token = accessIdInfo.token || randomUUID();

        if (!accessIdInfo.token) {
            const client = getClient();
            await client.multi()
                .set(`access-token:${token}`, accessId)
                .expire(`access-token:${token}`, config.accessTtl)
                .set(`access-id:${accessId}`, JSON.stringify({identities, token}))
                .expire(`access-id:${accessId}`, config.accessTtl)
                .exec();
        }

        return token;
    }

    return null;
}

async function getAccessIdForAccessToken(accessToken: string): Promise<string | null> {
    return getClient().get(`access-token:${accessToken}`);
}

export async function getAccessIdFromRequest(ctx: Context, acceptToken = false): Promise<string | null> {
    if (acceptToken && 'authorization' in ctx.headers && ctx.headers.authorization) {
        logger.debug('Found token in header for current request');

        const accessToken = ctx.headers.authorization.replace('Bearer', '').trim();
        return getAccessIdForAccessToken(accessToken);
    }

    const accessCookie = ctx.cookies.get('access') || null;
    if (accessCookie)
        logger.debug('Found access cookie for current request');

    return accessCookie;
}

export async function removeAccessIdFromRequest(ctx: Context): Promise<void> {
    const accessId = ctx.cookies.get('access');
    if (accessId) {
        const accessIdInfo = await getIdentitiesAndTokensForAccessId(accessId);
        if (accessIdInfo) {
            const client = getClient();

            let multi: any = client.multi().del(`access-id:${accessId}`);
            if (accessIdInfo.token)
                multi = multi.del(`access-token:${accessIdInfo.token}`);

            await multi.exec();
        }
    }
}

function getClient(): RedisClientType {
    const client = getPersistentClient();
    if (!client)
        throw new Error('A persistent Redis server is required for authentication!');

    return client;
}
