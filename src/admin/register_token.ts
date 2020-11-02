import {v4 as uuid} from 'uuid';
import moment from 'moment';

import {Token} from '../lib/Security';
import HttpError from '../lib/HttpError';
import {getPersistentClient} from '../lib/Redis';

export default async function registerToken(token: string | null, collection: string | null,
                                            from: moment.Moment | null, to: moment.Moment | null): Promise<Token> {
    const client = getPersistentClient();
    if (!client)
        throw new HttpError(400, 'There is no persistent Redis server configured for auth!');

    if (!collection)
        throw new HttpError(400, 'Please provide a collection!');

    token = token || uuid();
    from = from ? moment(from) : null;
    to = to ? moment(to) : null;

    if (from && !from.isValid())
        throw new HttpError(400, 'Please provide a valid from date!');

    if (to && !to.isValid())
        throw new HttpError(400, 'Please provide a valid to date!');

    if (from && to && !from.isBefore(to))
        throw new HttpError(400, 'Please provide a valid date range!');

    const tokenInfo: Token = {
        token,
        collection_id: collection,
        from: from ? from.toDate() : null,
        to: to ? to.toDate() : null
    };

    let multi: any = client.multi().set(`token:${token}`, JSON.stringify(tokenInfo));
    if (to)
        multi = multi.expireat(`token:${token}`, to.unix());

    await multi.exec();

    return tokenInfo;
}
