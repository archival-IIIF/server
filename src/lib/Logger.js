const {createLogger, transports, format} = require('winston');
const config = require('./Config');

const stackTraceFormat = format(info => {
    if (info.meta && info.meta instanceof Error)
        info.message = `${info.message}\n${info.meta.stack}`;
    return info;
});

const logger = createLogger({
    transports: [
        new transports.File({
            level: config.logLevel,
            filename: __dirname + '/../../application.log',
            handleExceptions: true,
            maxsize: 5242880, // 5 MB
            maxFiles: 5,
            tailable: true,
            format: format.combine(
                format.splat(),
                stackTraceFormat(),
                format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
                format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
            )
        }),
        new transports.Console({
            level: config.logLevel,
            handleExceptions: true,
            format: format.combine(
                format.splat(),
                format.colorize(),
                stackTraceFormat(),
                format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
                format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
            )
        })
    ],
    exitOnError: false
});

logger.emitErrs = false;

logger.stream = {
    write: function (message) {
        logger.debug(message.trim());
    }
};

module.exports = logger;
