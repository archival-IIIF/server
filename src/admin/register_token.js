const uuid = require('uuid/v4');
const moment = require('moment');

const HttpError = require('../lib/HttpError');
const client = require('../lib/ElasticSearch');

async function registerToken(token, collection, from, to) {
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

    const tokenInfo = {
        token,
        collection_id: collection,
        from: from ? from.toDate() : null,
        to: to ? to.toDate() : null
    };

    await client.index({
        index: 'tokens',
        type: '_doc',
        id: token,
        body: tokenInfo
    });

    return tokenInfo;
}

module.exports = registerToken;
