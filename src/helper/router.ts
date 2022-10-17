import Router from '@koa/router';
import {DefaultState} from 'koa';

import config from '../lib/Config.js';
import {ExtendedContext} from '../lib/Koa.js';

export const router = new Router<DefaultState, ExtendedContext>({prefix: '/helper'});

router.get('/viewer', async ctx => {
    ctx.redirect(config.viewerUrl + ctx.queryFirst('manifest'));
});
