import {Context} from 'koa';

export interface ExtendedContext extends Context {
    queryFirst(param: string): string | undefined;
}

export function extendContext(ctx: Context): void {
    const q = ctx.query;
    ctx.queryFirst = (param: string): string | undefined => {
        const content = q[param];
        return Array.isArray(content) ? content[0] : content;
    };
}
