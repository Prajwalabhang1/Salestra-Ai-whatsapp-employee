/**
 * Correlation ID Middleware
 * Tracks requests across the entire application stack for distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type to include correlationId
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
            tenantId?: string;  // For multi-tenant context
        }
    }
}

/**
 * Middleware to generate/extract correlation ID
 * Checks for existing ID in headers, otherwise generates new UUID
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
    // Extract from header or generate new
    const correlationId =
        (req.headers['x-correlation-id'] as string) ||
        (req.headers['x-request-id'] as string) ||
        uuidv4();

    // Attach to request object
    req.correlationId = correlationId;

    // Send back in response headers for client-side tracking
    res.setHeader('X-Correlation-ID', correlationId);

    // For OPTIONS requests, respond immediately
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
}

/**
 * Get correlation ID from request (helper function)
 */
export function getCorrelationId(req: Request): string {
    return req.correlationId || 'unknown';
}

/**
 * Create a child correlation ID for sub-operations
 * Format: parent-correlation-id.child-operation-name
 */
export function createChildCorrelationId(parentId: string, operation: string): string {
    return `${parentId}.${operation}`;
}
