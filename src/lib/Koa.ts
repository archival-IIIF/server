import {Context} from 'koa';

export interface ExtendedContext extends Context {
    queryFirst(param: string): string | undefined;
}

export function extendContext(ctx: Context): void {
    ctx.queryFirst = function (param: string): string | undefined {
        const content = this.query[param];
        return Array.isArray(content) ? content[0] : content;
    };
}
