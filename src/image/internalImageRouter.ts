import * as Router from 'koa-router';

import config from '../lib/Config';
import logger from '../lib/Logger';

import serveImage from './internal';
import {ImageProcessingInfo} from './ImageProcessing';

const router = new Router();

router.get('/:path/:region/:size/:rotation/:quality.:format', async ctx => {
    logger.info(`Received a request for an image on path ${ctx.params.path}`);

    const processingInfo: ImageProcessingInfo = {
        rootPath: config.dataRootPath,
        relativePath: ctx.params.path
    };

    const image = await serveImage(processingInfo, {
        region: ctx.params.region,
        size: ctx.params.size,
        rotation: ctx.params.rotation,
        quality: ctx.params.quality,
        format: ctx.params.format
    });

    ctx.body = image.image;
    ctx.status = image.status;
    if (image.contentType) ctx.set('Content-Type', image.contentType);
    if (image.contentLength) ctx.set('Content-Length', String(image.contentLength));
    ctx.set('Content-Disposition', `inline; filename="${ctx.params.id}-${ctx.params.region}-${ctx.params.size}-${ctx.params.rotation}-${ctx.params.quality}.${ctx.params.format}"`);

    logger.info(`Sending an image on path ${ctx.params.path}`);
});

export default router;
