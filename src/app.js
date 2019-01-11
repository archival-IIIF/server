const config = require('./lib/Config');
const logger = require('./lib/Logger');
const {servicesRunning} = require('./lib/Service');

servicesRunning.forEach(function initService(service) {
    if (service.runAs === 'web')
        startWeb();
    else if (service.runAs === 'worker')
        startWorker(service);
    else if (service.runAs === 'cron')
        startCron(service);
});

function startWeb() {
    const Koa = require('koa');
    const morgan = require('koa-morgan');
    const json = require('koa-json');
    const bodyParser = require('koa-bodyparser');
    const compress = require('koa-compress');

    const iiifImageRouter = require('./image/router');
    const iiifPresentationRouter = require('./presentation/router');
    const iiifAuthRouter = require('./authentication/router');
    const fileRouter = require('./file/router');
    const adminRouter = require('./admin/router');
    const staticRouter = require('./static/router');

    const app = new Koa();

    app.use(async (ctx, next) => {
        ctx.set('Access-Control-Allow-Origin', '*');
        ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        if (ctx.method === 'OPTIONS')
            ctx.status = 204;
        else
            await next();
    });

    app.use(async (ctx, next) => {
        try {
            await next();
        }
        catch (err) {
            ctx.status = err.status || 500;
            ctx.body = (err.status && err.status < 500) ? err.message : 'Internal Server Error';

            if (!err.status || err.status >= 500)
                ctx.app.emit('error', err, ctx);
        }
    });

    app.on('error', (err, ctx) => {
        if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
        logger.error(`${err.status || 500} - ${ctx.method} - ${ctx.originalUrl} - ${err.message}`, err);
    });

    if (config.env !== 'production')
        app.use(morgan('short', {'stream': logger.stream}));

    app.use(compress());
    app.use(json({pretty: false, param: 'pretty'}));
    app.use(bodyParser());

    app.use(iiifImageRouter.routes());
    app.use(iiifPresentationRouter.routes());
    app.use(iiifAuthRouter.routes());

    app.use(fileRouter.routes());
    app.use(adminRouter.routes());
    app.use(staticRouter.routes());

    app.proxy = true;
    app.keys = [config.secret];

    app.listen(config.port);
    logger.info('Started the web service');
}

function startWorker(service) {
    const onTask = require('./lib/Worker.js');
    onTask(service.type, service.getService());
    logger.info(`Worker initialized for ${service.name}`);
}

function startCron(service) {
    const cron = require('node-cron');
    cron.schedule(service.cron, service.getService());
    logger.info(`Cron ${service.cron} scheduled for ${service.name}`);
}