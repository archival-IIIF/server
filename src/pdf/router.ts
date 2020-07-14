import * as Router from '@koa/router';

import logger from '../lib/Logger';
import HttpError from '../lib/HttpError';
import {ImageItem, RootItem} from '../lib/ItemInterfaces';
import {getChildItems, getItem} from '../lib/Item';
import {AccessState, hasAccess} from '../lib/Security';

import createPDF from './pdfCreation';

const router = new Router({prefix: '/pdf'});

router.get('/:id', async ctx => {
    logger.info(`Received a request for a pdf with id ${ctx.params.id}`);

    const item = await getItem(ctx.params.id);
    if (!item || item.type !== 'root')
        throw new HttpError(404, `No manifest found with id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, false);
    if (access.state === AccessState.CLOSED)
        throw new HttpError(401, 'Access denied!');

    const pages = ctx.query.pages
        ? (ctx.query.pages as string[])
            .map(page => parseInt(page))
            .filter(page => !isNaN(page))
        : [];

    const children = (await getChildItems(item.id))
        .filter(item => item.type === 'image')
        .filter(item => item.order && (!ctx.query.pages || pages.includes(item.order))) as ImageItem[];

    if (children.length === 0)
        throw new HttpError(400, `Not able to produce pdf for manifest with id ${ctx.params.id}`);

    const pdf = await createPDF(item as RootItem, children, access.tier);

    ctx.set('Content-Type', 'application/pdf');
    ctx.set('Content-Disposition', `attachment; filename="${item.id}.pdf"`);
    ctx.body = pdf;

    logger.info(`Sending a pdf with id ${ctx.params.id}`);
});

export default router;
