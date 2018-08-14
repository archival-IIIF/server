const uuid = require('uuid/v4');
const moment = require('moment');

const {db, pg} = require('../lib/DB');
const HttpError = require('../lib/HttpError');

async function registerToken(token, container, from, to) {
    if (!container)
        throw new HttpError(400, 'Please provide a container!');

    token = token || uuid();
    from = from ? moment(from) : null;
    to = to ? moment(to) : null;

    if (from && !from.isValid())
        throw new HttpError(400, 'Please provide a valid from date!');

    if (to && !to.isValid())
        throw new HttpError(400, 'Please provide a valid to date!');

    if (from && to && !from.isBefore(to))
        throw new HttpError(400, 'Please provide a valid date range!');

    const items = {token, container_id: container, from: from ? from.toDate() : null, to: to ? to.toDate() : null};
    const sql = pg.helpers.insert(items, new pg.helpers.ColumnSet(['token', 'container_id', 'from', 'to']), 'tokens');
    await db.none(sql, items);

    return token;
}

module.exports = registerToken;
