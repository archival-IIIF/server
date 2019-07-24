import * as uuid from 'uuid/v4';
import * as moment from 'moment';

import HttpError from '../lib/HttpError';
import getClient, {IndexRequest} from '../lib/ElasticSearch';
import {Token} from '../lib/Security';

export default async function registerToken(token: string | null, collection: string | null,
                                            from: moment.Moment | null, to: moment.Moment | null): Promise<Token> {
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

    await getClient().index(<IndexRequest<Token>>{
        index: 'tokens',
        id: token,
        body: tokenInfo
    });

    return tokenInfo;
}
