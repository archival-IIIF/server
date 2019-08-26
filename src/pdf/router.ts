import * as Router from 'koa-router';

import logger from '../lib/Logger';
import {getChildItems, getItem} from '../lib/Item';
import HttpError from '../lib/HttpError';
import createPDF from './pdfCreation';
import {AccessState, hasAccess} from '../lib/Security';
import {ImageItem} from '../lib/ItemInterfaces';
import {getTextsForCollectionId} from '../lib/Text';

const router = new Router({prefix: '/pdf'});

router.get('/:id', async ctx => {
    logger.info(`Received a request for a pdf with id ${ctx.params.id}`);

    const item = await getItem(ctx.params.id);
    if (!item || item.type !== 'root')
        throw new HttpError(404, `No image with the id ${ctx.params.id}`);

    const children = await getChildItems(item.id);
    if (children.length === 0 || children[0].type !== 'image')
        throw new HttpError(400, `Not able to produce pdf for the id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, false);
    if (access.state === AccessState.CLOSED)
        throw new HttpError(401, 'Access denied!');

    const texts = await getTextsForCollectionId(item.id, 'transcription', 'alto');
    const buffer = await createPDF(children as ImageItem[], texts, access.tier);

    ctx.set('Content-Type', 'application/pdf');
    ctx.body = buffer;

    logger.info(`Sending a pdf with id ${ctx.params.id}`);
});

export default router;
