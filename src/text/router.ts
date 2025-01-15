import {readFileSync} from 'node:fs';
import Router from '@koa/router';
import {DefaultState} from 'koa';

import {getText} from '../lib/Text.js';
import logger from '../lib/Logger.js';
import HttpError from '../lib/HttpError.js';
import {ExtendedContext} from '../lib/Koa.js';

const htmlTemplate = readFileSync('src/text/text.html', 'utf8');

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/text'});

router.get('/:id', async ctx => {
    logger.info(`Received a request for text with id ${ctx.params.id}`);

    const text = await getText(ctx.params.id);
    if (!text)
        throw new HttpError(404, `No text found with id ${ctx.params.id}`);

    const title = text.type === 'transcription' ? 'Transcription' : `Translation ${text.language}`;

    ctx.type = 'text/html';
    ctx.body = htmlTemplate.replace('{{title}}', title).replace('{{text}}', text.text);

    logger.info(`Sending a text with id ${ctx.params.id}`);
});

router.get('/:id/txt', async ctx => {
    logger.info(`Received a request for plain text version for text with id ${ctx.params.id}`);

    const text = await getText(ctx.params.id);
    if (!text)
        throw new HttpError(404, `No text found with id ${ctx.params.id}`);

    const type = text.type === 'transcription' ? 'transcription' : text.language;
    ctx.set('Content-Disposition', `attachment; filename="${text.item_id}_${type}_${text.id}.txt`);

    ctx.type = 'text/plain';
    ctx.body = text.text;

    logger.info(`Sending a plain text version for text with id ${ctx.params.id}`);
});
