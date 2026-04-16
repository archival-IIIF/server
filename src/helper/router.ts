import Router from '@koa/router';
import type {DefaultState} from 'koa';

import config from '../lib/Config.ts';
import type {ExtendedContext} from '../lib/Koa.ts';

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/helper'});

router.get('/viewer', async ctx => {
    ctx.redirect(config.viewerUrl + ctx.queryFirst('manifest'));
});
