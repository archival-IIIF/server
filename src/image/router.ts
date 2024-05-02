import {existsSync} from 'fs';
import {Image} from '@archival-iiif/presentation-builder/v2';

import Router from '@koa/router';
import {Context, DefaultState, ParameterizedContext} from 'koa';

import parseSize from './sizeParser.js';
import {getImage, getLogo, getAudio, getProfile, ImageOptions} from './imageServer.js';

import logger from '../lib/Logger.js';
import config from '../lib/Config.js';
import {cache} from '../lib/Cache.js';
import HttpError from '../lib/HttpError.js';
import {ExtendedContext} from '../lib/Koa.js';
import {ImageItem, Item} from '../lib/ItemInterfaces.js';
import derivatives, {DerivativeType} from '../lib/Derivative.js';
import {Access, AccessState, hasAccess} from '../lib/Security.js';
import {determineItem, getFullDerivativePath} from '../lib/Item.js';

import {getImageInfo, getStaticImageInfo} from '../builder/PresentationBuilder.js';

type ImageContext = ParameterizedContext<DefaultState, ExtendedContext & ImageOptions>;

const prefix = '/iiif/image';
export const router = new Router<DefaultState, ExtendedContext>({prefix});

router.get('/:id', ctx => {
    ctx.status = 303;
    ctx.redirect(`${prefix}/${ctx.params.id}/info.json`);
});

router.get('/:name(logo|audio)/info.json', async ctx => {
    logger.info(`Received a request for image info of the ${ctx.params.name}`);

    if (ctx.params.name === 'logo' && !config.logoRelativePath)
        throw new HttpError(404, 'No logo');
    if (ctx.params.name === 'audio' && !config.audioRelativePath)
        throw new HttpError(404, 'No audio');

    setContentType(ctx);

    if (ctx.params.name === 'logo' || ctx.params.name === 'audio')
        ctx.body = await getStaticImageInfo(ctx.params.name, getProfile());

    logger.info(`Sending image info of the ${ctx.params.name}`);
});

router.get('/:id/info.json', async ctx => {
    const [id, tier] = ctx.params.id.split(config.imageTierSeparator);

    logger.info(`Received a request for image info with id ${id} on tier ${tier}`);

    const [item, derivative] = await getItemAndDerivative(id, tier);

    if (item.type === 'audio') {
        ctx.redirect(`${prefix}/audio/info.json`);
        return;
    }

    const access = await hasAccess(ctx, item, true);
    if (access.state === AccessState.CLOSED) {
        setContentType(ctx);
        ctx.status = 401;
        ctx.body = await getImageInfo(item, derivative, getProfile(), access);
        logger.info(`Sending image info with id ${id} and tier ${tier}`);
        return;
    }
    else if (access.state === AccessState.OPEN && shouldRedirect(derivative, access, tier)) {
        ctx.redirect(`${prefix}/${id}/info.json`);
        return;
    }

    if (access.state === AccessState.TIERED && shouldRedirect(derivative, access, tier)) {
        ctx.redirect(`${prefix}/${id}${config.imageTierSeparator}${access.tier.name}/info.json`);
        return;
    }

    setContentType(ctx);
    ctx.body = await cache('image', id, ctx.params.id,
        async () => getImageInfo(item as ImageItem, derivative, getProfile(), access));

    logger.info(`Sending image info with id ${id} and tier ${tier}`);
});

router.get('/:name(logo|audio)/:region/:size/:rotation/:quality.:format', async (ctx: ImageContext) => {
    logger.info(`Received a request for the ${ctx.params.name}`);

    if (ctx.params.name === 'logo' && !config.logoRelativePath)
        throw new HttpError(404, 'No logo');
    if (ctx.params.name === 'audio' && !config.audioRelativePath)
        throw new HttpError(404, 'No audio');

    const image = ctx.params.name === 'logo'
        ? await getLogo(ctx.params)
        : await getAudio(ctx.params);

    ctx.body = image.image;
    ctx.status = image.status;
    if (image.contentType) ctx.set('Content-Type', image.contentType);
    if (image.contentLength) ctx.set('Content-Length', String(image.contentLength));
    ctx.set('Content-Disposition', `inline; filename="logo-${ctx.params.region}-${ctx.params.size}-${ctx.params.rotation}-${ctx.params.quality}.${ctx.params.format}"`);

    logger.info(`Sending the ${ctx.params.name}`);
});

router.get('/:id/:region/:size/:rotation/:quality.:format', async (ctx: ImageContext) => {
    const [id, tier] = ctx.params.id.split(config.imageTierSeparator);

    logger.info(`Received a request for an image with id ${id} on tier ${tier}`);

    const [item, derivative] = await getItemAndDerivative(id, tier);

    if (item.type === 'audio') {
        ctx.redirect(`${prefix}/audio/${ctx.params.region}/${ctx.params.size}/${ctx.params.rotation}/${ctx.params.quality}.${ctx.params.format}`);
        return;
    }

    const access = await hasAccess(ctx, item, false);
    if (access.state === AccessState.CLOSED)
        throw new HttpError(401, 'Access denied!');

    if (access.state === AccessState.OPEN && shouldRedirect(derivative, access, tier)) {
        ctx.redirect(`${prefix}/${id}/${ctx.params.region}/${ctx.params.size}/${ctx.params.rotation}/${ctx.params.quality}.${ctx.params.format}`);
        return;
    }

    if (access.state === AccessState.TIERED && shouldRedirect(derivative, access, tier)) {
        ctx.redirect(`${prefix}/${id}${config.imageTierSeparator}${access.tier.name}/${ctx.params.region}/${ctx.params.size}/${ctx.params.rotation}/${ctx.params.quality}.${ctx.params.format}`);
        return;
    }

    if (item.type === 'image') {
        const imageItem = item as ImageItem;
        const size = access.tier
            ? Image.computeMaxSize(access.tier, imageItem.width, imageItem.height)
            : {width: imageItem.width, height: imageItem.height};

        const requestedSize = parseSize(ctx.params.size, size);
        if (requestedSize && (requestedSize.width > size.width || requestedSize.height > size.height)) {
            ctx.redirect(`${prefix}/${ctx.params.id}/${ctx.params.region}/max/${ctx.params.rotation}/${ctx.params.quality}.${ctx.params.format}`);
            return;
        }
    }

    const max = item.type === 'image' && access.tier ? access.tier.maxSize : null;
    const image = await getImage(item, derivative, max, ctx.params);

    ctx.body = image.image;
    ctx.status = image.status;
    if (image.contentType) ctx.set('Content-Type', image.contentType);
    if (image.contentLength) ctx.set('Content-Length', String(image.contentLength));
    ctx.set('Content-Disposition', `inline; filename="${ctx.params.id}-${ctx.params.region}-${ctx.params.size}-${ctx.params.rotation}-${ctx.params.quality}.${ctx.params.format}"`);

    logger.info(`Sending an image with id ${id} and tier ${tier}`);
});

async function getItemAndDerivative(id: string, tier: string): Promise<[Item, DerivativeType | null]> {
    const item = await determineItem(id);
    if (!item)
        throw new HttpError(404, `No image with the id ${id}`);

    const derivative = item.type !== 'image'
        ? Object.values(derivatives).find(derivative =>
            derivative.from === item.type && derivative.to === 'image' && tier === derivative.imageTier)
        : null;

    if (derivative) {
        const fullPath = getFullDerivativePath(item, derivative);
        if (!existsSync(fullPath))
            throw new HttpError(404, `No image with id ${id}`);
    }

    if (item.type === 'audio' && (!config.audioRelativePath))
        throw new HttpError(404, `No image with id ${id}`);

    return [item, derivative || null];
}

function shouldRedirect(derivative: DerivativeType | null, access: Access, tier?: string): boolean {
    const unnecessaryTier = tier && access.state === AccessState.OPEN && derivative?.imageTier !== tier;
    const wrongTier = tier && (access.state === AccessState.TIERED) && (tier !== access.tier.name);
    const noTier = !tier && (access.state === AccessState.TIERED);

    return unnecessaryTier || wrongTier || noTier;
}

function setContentType(ctx: Context): void {
    switch (ctx.accepts('application/ld+json', 'application/json')) {
        case 'application/json':
            ctx.set('Content-Type', 'application/json');
            break;
        case 'application/ld+json':
        default:
            ctx.set('Content-Type', 'application/ld+json;profile="http://iiif.io/api/image/2/context.json"');
    }
}
