import {createLogger, transports, format} from 'winston';
import config from './Config';

const stackTraceFormat = format(info => {
    if (info.err)
        info.message = `${info.message}: ${info.err.stack}`;
    return info;
});

const logger = createLogger({
    transports: [
        // new transports.File({
        //     level: config.logLevel,
        //     filename: __dirname + '/../../application.log',
        //     handleExceptions: true,
        //     maxsize: 5242880, // 5 MB
        //     maxFiles: 5,
        //     tailable: true,
        //     format: format.combine(
        //         stackTraceFormat(),
        //         format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        //         format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
        //     )
        // }),
        new transports.Console({
            level: config.logLevel,
            handleExceptions: true,
            format: format.combine(
                format.colorize(),
                stackTraceFormat(),
                format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
                format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
            )
        })
    ],
    exitOnError: false
});

// @ts-ignore
logger.emitErrs = false;

logger.stream = {
    // @ts-ignore
    write: function (message: string): void {
        logger.debug(message.trim());
    }
};

export default logger;
