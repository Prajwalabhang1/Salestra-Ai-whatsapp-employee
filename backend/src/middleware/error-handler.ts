/**
 * Global Error Handler Middleware
 * Centralized error handling for consistent error responses and logging
 */

import { Request, Response, NextFunction } from 'express';
import { ApplicationError, toApplicationError, isOperationalError } from '../lib/errors.js';
import { logger } from '../lib/logger-v2.js';

/**
 * Global error handling middleware
 * Should be registered LAST in middleware chain
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // Convert to ApplicationError if needed
    const appError = err instanceof ApplicationError ? err : toApplicationError(err);

    // Log the error with full context
    const logContext = {
        correlationId: req.correlationId,
        error: {
            name: appError.name,
            message: appError.message,
            code: appError.code,
            stack: appError.stack
        },
        request: {
            method: req.method,
            path: req.path,
            query: req.query,
            ip: req.ip,
            userAgent: req.get('user-agent')
        },
        context: appError.context,
        isOperational: appError.isOperational
    };

    // Choose log level based on error severity
    if (appError.statusCode >= 500) {
        logger.error('Server error occurred', logContext);
    } else if (appError.statusCode >= 400) {
        logger.warn('Client error occurred', logContext);
    } else {
        logger.info('Request error', logContext);
    }

    // For non-operational errors, alert the team
    if (!appError.isOperational) {
        logger.error('🚨 NON-OPERATIONAL ERROR - REQUIRES IMMEDIATE ATTENTION', {
            ...logContext,
            alert: true
        });
    }

    // Determine response based on environment
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Build error response
    const errorResponse: any = {
        success: false,
        error: {
            code: appError.code,
            message: appError.message,
            correlationId: req.correlationId
        }
    };

    // Include more details in development
    if (isDevelopment) {
        errorResponse.error.stack = appError.stack;
        errorResponse.error.context = appError.context;
    }

    // Send response
    res.status(appError.statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 * Automatically catches async errors and passes to error handler
 */
export function asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 404 handler (unmatched routes)
 */
export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
            correlationId: req.correlationId
        }
    });
}
