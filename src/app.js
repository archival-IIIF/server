const Koa = require('koa');
const morgan = require('koa-morgan');
const json = require('koa-json');
const serve = require('koa-static-server');
const bodyParser = require('koa-bodyparser');

const path = require('path');

const logger = require('./helpers/Logger.js');
const config = require('./helpers/Config.js');

const iiifImageRouter = require('./routes/iiifImage');
const iiifPresentationRouter = require('./routes/iiifPresentation');
const iiifAuthRouter = require('./routes/iiifAuth');
const fileRouter = require('./routes/file');
const importRouter = require('./routes/import');

const app = new Koa();

if (config.env !== 'production')
    app.use(morgan('short', {'stream': logger.stream}));

app.use(json({pretty: false, param: 'pretty'}));
app.use(bodyParser({jsonLimit: '50mb'}));

app.use(serve({rootDir: path.join(__dirname, 'public/file-icons'), rootPath: '/file-icons'}));
app.use(serve({rootDir: config.universalViewerPath, rootPath: '/universalviewer', index: 'uv.html'}));
app.use(serve({rootDir: config.archivalViewerPath, rootPath: '/archivalviewer'}));

app.use(async (ctx, next) => {
    ctx.set("Access-Control-Allow-Origin", "*");
    ctx.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    await next();
});

app.use(iiifImageRouter.routes());
app.use(iiifPresentationRouter.routes());
app.use(iiifAuthRouter.routes());

app.use(fileRouter.routes());
app.use(importRouter.routes());

app.listen(config.port);
