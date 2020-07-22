import {Context} from 'koa';

import Manifest from './elem/v3/Manifest';
import Collection from './elem/v3/Collection';

export function setContent(ctx: Context, jsonDoc: Manifest | Collection | null): void {
    if (jsonDoc === null)
        return;

    switch (ctx.accepts('application/ld+json', 'application/json')) {
        case 'application/json':
            ctx.body = jsonDoc;
            ctx.set('Content-Type', 'application/json');
            break;
        case 'application/ld+json':
        default:
            ctx.body = jsonDoc;
            ctx.set('Content-Type', 'application/ld+json;profile=http://iiif.io/api/presentation/3/context.json');
    }
}
