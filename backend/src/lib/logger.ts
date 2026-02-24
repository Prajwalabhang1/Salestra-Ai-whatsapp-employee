import winston from 'winston';

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(logColors);

const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

const transports = [
    new winston.transports.Console(),
    // Temporarily disabled file logging to debug startup issues
    // new winston.transports.File({
    //     filename: 'logs/error.log',
    //     level: 'error',
    // }),
    // new winston.transports.File({ filename: 'logs/all.log' }),
];

export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    levels: logLevels,
    format,
    transports,
});

export const logAudit = (message: string, meta?: any) => {
    logger.info(`AUDIT: ${message}`, meta);
};

export default logger;
