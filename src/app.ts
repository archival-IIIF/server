import {DefaultState} from 'koa';

import config from './lib/Config.js';
import logger from './lib/Logger.js';

import {extendContext, ExtendedContext} from './lib/Koa.js';
import {
    isRunningWeb,
    workersRunning,
    standalonesRunning,
    cronsRunning,
    ImplementationService,
    CronImplementationService
} from './lib/Service.js';

if (isRunningWeb)
    await startWeb();

for (const type of Object.keys(workersRunning))
    await startWorker(type, workersRunning[type]);

if (config.appInstance === undefined || parseInt(config.appInstance) === 0) {
    for (const type of Object.keys(standalonesRunning))
        await startStandalone(standalonesRunning[type]);

    for (const type of Object.keys(cronsRunning))
        await startCron(cronsRunning[type]);
}

async function startWeb() {
    const {default: Koa} = await import('koa');
    const {default: json} = await import('koa-json');
    const {default: bodyParser} = await import('koa-bodyparser');
    const {default: compress} = await import('koa-compress');

    const {router: iiifImageRouter} = await import('./image/router.js');
    const {router: iiifPresentationRouter} = await import('./presentation/router.js');
    const {router: iiifSearchRouter} = await import('./search/router.js');
    const {router: iiifAuthRouter} = await import('./authentication/router.js');
    const {router: fileRouter} = await import('./file/router.js');
    const {router: pdfRouter} = await import('./pdf/router.js');
    const {router: adminRouter} = await import('./admin/router.js');
    const {router: textRouter} = await import('./text/router.js');
    const {router: helperRouter} = await import('./helper/router.js');
    const {router: staticRouter} = await import('./static/router.js');

    const app = new Koa<DefaultState, ExtendedContext>();

    app.use(async (ctx, next) => {
        ctx.set('Access-Control-Allow-Origin', '*');
        ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        if (ctx.method === 'OPTIONS')
            ctx.status = 204;
        else
            await next();
    });

    app.use(async (ctx, next) => {
        extendContext(ctx);
        await next();
    });

    app.use(async (ctx, next) => {
        try {
            await next();
        }
        catch (err: any) {
            ctx.status = err.status || 500;
            ctx.body = (err.status && err.status < 500) ? err.message : 'Internal Server Error';

            if (!err.status || err.status >= 500)
                ctx.app.emit('error', err, ctx);
        }
    });

    app.on('error', (err, ctx) => {
        if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
        logger.error(`${err.status || 500} - ${ctx.method} - ${ctx.originalUrl} - ${err.message}`, {err});
    });

    if (config.env !== 'production') {
        const {default: morgan} = await import('koa-morgan');
        // @ts-ignore
        app.use(morgan('short', {'stream': logger.stream}));
    }

    app.use(compress());
    app.use(json({pretty: false, param: 'pretty'}));
    app.use(bodyParser());

    app.use(iiifImageRouter.routes());
    app.use(iiifPresentationRouter.routes());
    app.use(iiifSearchRouter.routes());
    app.use(iiifAuthRouter.routes());

    app.use(fileRouter.routes());
    app.use(pdfRouter.routes());
    app.use(adminRouter.routes());
    app.use(textRouter.routes());
    app.use(helperRouter.routes());
    app.use(staticRouter.routes());

    app.proxy = true;
    app.keys = [config.secret];

    app.listen(config.port);

    logger.info(`Started the web service on ${config.baseUrl} 🚀`);
}

async function startWorker(type: string, service: ImplementationService) {
    const {onTask} = await import('./lib/Worker.js');
    onTask(type, await service.loadService());
    logger.info(`Worker initialized for '${service.name}'`);
}

async function startStandalone(service: ImplementationService) {
    const serviceFunc = await service.loadService();
    serviceFunc();
    logger.info(`Standalone initialized for '${service.name}'`);
}

async function startCron(service: CronImplementationService) {
    const cron = await import('node-cron');
    cron.schedule(service.cron, await service.loadService());
    logger.info(`Cron ${service.cron} scheduled for ${service.name}`);
}
