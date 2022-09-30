import {DefaultState} from 'koa';
import Router from '@koa/router';

import HttpError from '../lib/HttpError.js';
import {Item} from '../lib/ItemInterfaces.js';
import {ExtendedContext} from '../lib/Koa.js';
import {getChildItems, getItem} from '../lib/Item.js';
import {Text, getText, getTextsForCollectionId, withTexts} from '../lib/Text.js';

import {getSearch, getAutocomplete} from '../builder/PresentationBuilder.js';
import {searchInCollection, searchInText, autoCompleteForCollection, autocompleteForText} from './search.js';

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/iiif/search'});

const ignored = (query: { [key: string]: any }) =>
    Object.keys(query).filter(key => ['motivation', 'date', 'user'].includes(key));

router.use(async (ctx, next) => {
    if (!ctx.queryFirst('q'))
        throw new HttpError(400, 'Query is missing!');
    await next();
});

router.get('/:id', async ctx => {
    const item = await getItem(ctx.params.id);
    const text = await getText(ctx.params.id);
    if (!item && !text)
        throw new HttpError(404, `No item found for id ${ctx.params.id}`);

    const id = item ? item.collection_id : (text as Text).id;
    const items = item ? await getChildItems(item) : [await getItem((text as Text).item_id) as Item];

    const searchResults = item
        ? await searchInCollection(ctx.queryFirst('q') as string, id)
        : await searchInText(ctx.queryFirst('q') as string, id);

    ctx.set('Content-Type', 'application/json');
    ctx.body = getSearch(searchResults, ctx.queryFirst('q') as string, ignored(ctx.query), items, id);
});

router.get('/:id/:type(_:language)?', async ctx => {
    const texts = await withTexts(getTextsForCollectionId(ctx.params.id, ctx.params.type, ctx.params.language));
    if (!texts || texts.length === 0)
        throw new HttpError(404,
            `No text found of type ${ctx.params.type} and language ${ctx.params.language} for item with id ${ctx.params.id}`);

    const collectionItem = await getItem(ctx.params.id);
    const items = await getChildItems(collectionItem as Item);

    const searchResults = await searchInCollection(
        ctx.queryFirst('q') as string, texts[0].collection_id, texts[0].type, texts[0].language);

    ctx.set('Content-Type', 'application/json');
    ctx.body = getSearch(searchResults, ctx.queryFirst('q') as string, ignored(ctx.query),
        items, texts[0].collection_id, texts[0].type, texts[0].language);
});

router.get('/autocomplete/:id', async ctx => {
    const item = await getItem(ctx.params.id);
    const text = await getText(ctx.params.id);
    if (!item && !text)
        throw new HttpError(404, `No item found for id ${ctx.params.id}`);

    const autocompleteResult = item
        ? await autoCompleteForCollection(ctx.queryFirst('q') as string, item.collection_id)
        : await autocompleteForText(ctx.queryFirst('q') as string, text ? text.id : '');

    ctx.set('Content-Type', 'application/json');
    ctx.body = getAutocomplete(autocompleteResult, ctx.queryFirst('q') as string, ignored(ctx.query),
        item ? item.collection_id : (text ? text.id : ''));
});

router.get('/autocomplete/:id/:type(_:language)?', async ctx => {
    const texts = await withTexts(getTextsForCollectionId(ctx.params.id, ctx.params.type, ctx.params.language));
    if (!texts || texts.length === 0)
        throw new HttpError(404,
            `No text found of type ${ctx.params.type} and language ${ctx.params.language} for item with id ${ctx.params.id}`);

    const autocompleteResult = await autoCompleteForCollection(
        ctx.queryFirst('q') as string, texts[0].collection_id, texts[0].type, texts[0].language);

    ctx.set('Content-Type', 'application/json');
    ctx.body = getAutocomplete(autocompleteResult, ctx.queryFirst('q') as string, ignored(ctx.query),
        texts[0].collection_id, texts[0].type, texts[0].language);
});
