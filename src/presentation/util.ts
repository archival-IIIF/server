import {Context} from 'koa';
import {Manifest, Collection, AnnotationPage} from '@archival-iiif/presentation-builder/v3';

export function setContent(ctx: Context, jsonDoc: Manifest | Collection | AnnotationPage | null): void {
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
