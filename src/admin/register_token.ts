import dayjs from 'dayjs';
import {randomUUID} from 'node:crypto';

import {Token} from '../lib/Security.js';
import HttpError from '../lib/HttpError.js';
import {getPersistentClient} from '../lib/Redis.js';

export default async function registerToken(token?: string, id?: string,
                                            from?: dayjs.Dayjs | string, to?: dayjs.Dayjs | string): Promise<Token> {
    const client = getPersistentClient();
    if (!client)
        throw new HttpError(400, 'There is no persistent Redis server configured for auth!');

    if (!id)
        throw new HttpError(400, 'Please provide an id!');

    token = token || randomUUID();
    from = from ? dayjs(from) : undefined;
    to = to ? dayjs(to) : undefined;

    if (from && !from.isValid())
        throw new HttpError(400, 'Please provide a valid from date!');

    if (to && !to.isValid())
        throw new HttpError(400, 'Please provide a valid to date!');

    if (from && to && !from.isBefore(to))
        throw new HttpError(400, 'Please provide a valid date range!');

    const tokenInfoResult = await client.get(`token:${token}`);
    const tokenInfo: Token = tokenInfoResult
        ? JSON.parse(tokenInfoResult)
        : {
            token,
            ids: [],
            from: from ? from.toDate() : null,
            to: to ? to.toDate() : null
        };

    if (!tokenInfo.ids.includes(id))
        tokenInfo.ids.push(id);

    let multi: any = client.multi().set(`token:${token}`, JSON.stringify(tokenInfo));
    if (tokenInfo.to)
        multi = multi.expireAt(`token:${token}`, dayjs(tokenInfo.to).unix());

    await multi.exec();

    return tokenInfo;
}
