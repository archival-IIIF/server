const winston = require('winston');
const config = require('./Config.js');

winston.emitErrs = true;

const logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: config.logLevel,
            filename: __dirname + '/../application.log',
            handleExceptions: true,
            json: false,
            maxsize: 5242880, // 5 MB
            maxFiles: 5,
            colorize: false
        }),
        new winston.transports.Console({
            level: config.logLevel,
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});

module.exports = logger;

module.exports.stream = {
    write: function (message, encoding) {
        logger.debug(message.trim());
    }
};
