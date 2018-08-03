const config = require('./lib/Config');
const logger = require('./lib/Logger');
const {servicesRunning} = require('./lib/Service');

servicesRunning.forEach(function initService(service) {
    if (service.runAs === 'web')
        startWeb();
    else if (service.runAs === 'worker')
        startWorker(service);
});

function startWeb() {
    const Koa = require('koa');
    const morgan = require('koa-morgan');
    const json = require('koa-json');
    const serve = require('koa-static-server');
    const bodyParser = require('koa-bodyparser');

    const path = require('path');
    const {fileIconsPath} = require('./lib/FileIcon');

    const iiifImageRouter = require('./image/router');
    const iiifPresentationRouter = require('./presentation/router');
    const iiifAuthRouter = require('./authentication/router');
    const fileRouter = require('./file/router');
    const adminRouter = require('./admin/router');

    const app = new Koa();

    app.use(async (ctx, next) => {
        ctx.set("Access-Control-Allow-Origin", "*");
        ctx.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        await next();
    });

    app.use(async (ctx, next) => {
        try {
            await next();
        }
        catch (e) {
            ctx.status = e.status || 500;
            ctx.body = (e.status && e.status < 500) ? e.message : 'Internal Server Error';

            if (!e.status || e.status >= 500)
                logger.error(e.message);
        }
    });

    if (config.env !== 'production')
        app.use(morgan('short', {'stream': logger.stream}));

    app.use(json({pretty: false, param: 'pretty'}));
    app.use(bodyParser());

    app.use(serve({rootDir: fileIconsPath, rootPath: '/file-icon'}));
    app.use(serve({rootDir: config.universalViewerPath, rootPath: '/universalviewer', index: 'uv.html'}));
    app.use(serve({rootDir: config.archivalViewerPath, rootPath: '/archivalviewer'}));

    app.use(iiifImageRouter.routes());
    app.use(iiifPresentationRouter.routes());
    app.use(iiifAuthRouter.routes());

    app.use(fileRouter.routes());
    app.use(adminRouter.routes());

    app.proxy = true;
    app.listen(config.port);
}

function startWorker(service) {
    const onTask = require('./lib/Worker.js');
    onTask(service.type, service.getService());
}