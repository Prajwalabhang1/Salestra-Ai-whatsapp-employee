/**
 * Production-Grade Structured Logger with Winston
 * Features:
 * - JSON structured logging
 * - Log levels (error, warn, info, debug)
 * - Multiple transports (console, file, audit)
 * - Log rotation
 * - PII masking
 * - Exception/rejection handling
 */

import winston from 'winston';
import { maskPII } from './pii-mask.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom format for structured logging
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    winston.format((info) => {
        // Mask PII before logging
        if (info.metadata) {
            info.metadata = maskPII(info.metadata);
        }
        return info;
    })(),
    winston.format.json()
);

// Pretty format for development console
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;

        // Add metadata if present (excluding some internal fields)
        const { metadata: meta, ...rest } = metadata;
        if (meta && Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }

        return msg;
    })
);

// Ensure logs directory exists
import { mkdirSync } from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
try {
    mkdirSync(logsDir, { recursive: true });
} catch (err) {
    // Directory already exists
}

// Create Winston logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    defaultMeta: {
        service: 'salestra-backend',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
    },
    transports: [
        // Console transport with pretty printing
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
        }),

        // Application logs
        new winston.transports.File({
            filename: path.join(logsDir, 'app.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            tailable: true
        }),

        // Error logs (separate file for easy monitoring)
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 30 // Keep errors longer
        }),

        // Audit logs (compliance, user actions)
        new winston.transports.File({
            filename: path.join(logsDir, 'audit.log'),
            level: 'info',
            maxsize: 52428800, // 50MB
            maxFiles: 90 // 90 days retention for audit
        })
    ],

    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 10485760,
            maxFiles: 5
        })
    ],

    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 10485760,
            maxFiles: 5
        })
    ]
});

// Convenience methods for common patterns
export const logWithContext = (level: string, message: string, context: any) => {
    logger.log(level, message, context);
};

export const logError = (message: string, error: Error, context?: any) => {
    logger.error(message, {
        error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
            ...(error as any).code && { code: (error as any).code }
        },
        ...context
    });
};

export const logAudit = (action: string, userId: string, details: any) => {
    logger.info(`AUDIT: ${action}`, {
        audit: true,
        userId,
        action,
        timestamp: new Date().toISOString(),
        ...details
    });
};

// Export logger as default as well
export default logger;
