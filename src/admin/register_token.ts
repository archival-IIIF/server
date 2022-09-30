import {v4 as uuid} from 'uuid';
import moment from 'moment';

import {Token} from '../lib/Security.js';
import HttpError from '../lib/HttpError.js';
import {getPersistentClient} from '../lib/Redis.js';

export default async function registerToken(token: string | undefined, collection: string | undefined,
                                            from: moment.Moment | string | undefined,
                                            to: moment.Moment | string | undefined): Promise<Token> {
    const client = getPersistentClient();
    if (!client)
        throw new HttpError(400, 'There is no persistent Redis server configured for auth!');

    if (!collection)
        throw new HttpError(400, 'Please provide a collection!');

    token = token || uuid();
    from = from ? moment(from) : undefined;
    to = to ? moment(to) : undefined;

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
            collection_ids: [],
            from: from ? from.toDate() : null,
            to: to ? to.toDate() : null
        };

    if (!tokenInfo.ids.includes(collection))
        tokenInfo.ids.push(collection);

    let multi: any = client.multi().set(`token:${token}`, JSON.stringify(tokenInfo));
    if (tokenInfo.to)
        multi = multi.expireat(`token:${token}`, moment(tokenInfo.to).unix());

    await multi.exec();

    return tokenInfo;
}
