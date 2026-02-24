/**
 * Custom Application Error Classes
 * Structured error hierarchy for better error handling and logging
 */

/**
 * Base application error class
 */
export class ApplicationError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly context?: Record<string, any>;
    public readonly timestamp: Date;

    constructor(
        message: string,
        code: string,
        statusCode: number = 500,
        isOperational: boolean = true,
        context?: Record<string, any>
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;
        this.timestamp = new Date();

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
        };
    }
}

/**
 * Database operation errors
 */
export class DatabaseError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, 'DATABASE_ERROR', 500, true, context);
    }
}

/**
 * Validation errors (user input)
 */
export class ValidationError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, 'VALIDATION_ERROR', 400, true, context);
    }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends ApplicationError {
    constructor(message: string = 'Authentication failed', context?: Record<string, any>) {
        super(message, 'AUTHENTICATION_ERROR', 401, true, context);
    }
}

/**
 * Authorization errors (permissions)
 */
export class AuthorizationError extends ApplicationError {
    constructor(message: string = 'Insufficient permissions', context?: Record<string, any>) {
        super(message, 'AUTHORIZATION_ERROR', 403, true, context);
    }
}

/**
 * External service errors (Evolution API, Ollama, etc.)
 */
export class ExternalServiceError extends ApplicationError {
    public readonly service: string;

    constructor(service: string, message: string, context?: Record<string, any>) {
        super(
            `${service} error: ${message}`,
            'EXTERNAL_SERVICE_ERROR',
            503,
            true,
            { ...context, service }
        );
        this.service = service;
    }
}

/**
 * AI processing errors
 */
export class AIProcessingError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, 'AI_PROCESSING_ERROR', 500, true, context);
    }
}

/**
 * Message queue errors
 */
export class QueueError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, 'QUEUE_ERROR', 500, true, context);
    }
}

/**
 * WhatsApp/Evolution API specific errors
 */
export class WhatsAppError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, 'WHATSAPP_ERROR', 500, true, context);
    }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends ApplicationError {
    constructor(resource: string, identifier?: string, context?: Record<string, any>) {
        const message = identifier
            ? `${resource} with identifier '${identifier}' not found`
            : `${resource} not found`;

        super(message, 'NOT_FOUND', 404, true, { ...context, resource, identifier });
    }
}

/**
 * Conflict errors (duplicate resources)
 */
export class ConflictError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, 'CONFLICT', 409, true, context);
    }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends ApplicationError {
    constructor(message: string = 'Rate limit exceeded', context?: Record<string, any>) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429, true, context);
    }
}

/**
 * Timeout errors
 */
export class TimeoutError extends ApplicationError {
    constructor(operation: string, timeoutMs: number, context?: Record<string, any>) {
        super(
            `Operation '${operation}' timed out after ${timeoutMs}ms`,
            'TIMEOUT',
            504,
            true,
            { ...context, operation, timeoutMs }
        );
    }
}

/**
 * Helper function to determine if error is operational
 */
export function isOperationalError(error: Error): boolean {
    if (error instanceof ApplicationError) {
        return error.isOperational;
    }
    return false;
}

/**
 * Helper to convert any error to ApplicationError
 */
export function toApplicationError(error: any): ApplicationError {
    if (error instanceof ApplicationError) {
        return error;
    }

    // Handle Prisma errors
    if (error.code && error.code.startsWith('P')) {
        return new DatabaseError(error.message, {
            code: error.code,
            meta: error.meta
        });
    }

    // Handle  other known errors
    if (error.name === 'ValidationError') {
        return new ValidationError(error.message);
    }

    // Generic conversion
    return new ApplicationError(
        error.message || 'An unexpected error occurred',
        'INTERNAL_ERROR',
        500,
        false,
        { originalError: error.name }
    );
}
