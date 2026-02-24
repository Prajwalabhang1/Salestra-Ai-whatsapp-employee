import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { evolutionAPI } from '../services/whatsapp/evolution.service.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import logger from '../lib/logger.js';

const router = Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get correlation ID from request for tracking
 */
function getCorrelationId(req: Request): string {
    return (req as any).correlationId || 'no-correlation-id';
}

/**
 * Log API request with context
 */
function logRequest(req: Request, endpoint: string, tenantId?: string) {
    const correlationId = getCorrelationId(req);
    logger.info(`[WhatsApp API] ${endpoint}`, {
        correlationId,
        tenantId,
        method: req.method,
        endpoint
    });
}

/**
 * Sanitize business name for instance naming
 */
function sanitizeBusinessName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_') // Replace special chars with underscore
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_|_$/g, '') // Remove leading/trailing underscores
        .substring(0, 30); // Limit length
}

/**
 * Log API response with timing
 */
function logResponse(req: Request, endpoint: string, success: boolean, duration: number, extra?: any) {
    const correlationId = getCorrelationId(req);
    const level = success ? 'info' : 'error';

    logger[level](`[WhatsApp API] ${endpoint} completed`, {
        correlationId,
        success,
        duration: `${duration}ms`,
        ...extra
    });
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Rate limiter for instance creation
 * Prevents abuse: Max 3 attempts per tenant per 5 minutes
 */
const createInstanceLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3, // 3 attempts per window
    skipSuccessfulRequests: false, // Count all attempts
    keyGenerator: (req: Request) => {
        // Limit per tenant, not per IP
        const tenantId = (req as AuthRequest).userId || 'anonymous';
        return `instance:create:${tenantId}`;
    },
    handler: (_req: Request, res: Response) => {
        logger.warn('[WhatsApp API] Rate limit exceeded for instance creation', {
            correlationId: getCorrelationId(_req),
            tenantId: (_req as AuthRequest).userId
        });
        res.status(429).json({
            success: false,
            error: 'Too many connection attempts. Please wait 5 minutes before trying again.',
            retryAfter: 300 // seconds
        });
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================================================
// ENDPOINTS
// ============================================================================

// ===================================================================
// POST /api/whatsapp/create-instance
// OPTIMIZED: Instance reuse, deterministic naming, atomic transactions
// SECURED: Rate limited to 3 attempts per 5 minutes per tenant
// ===================================================================
router.post('/create-instance', authenticate, createInstanceLimiter, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const correlationId = getCorrelationId(req);
    const tenantId = (req as AuthRequest).userId; // Auth middleware sets userId (which contains tenantId)
    const { whatsappNumber } = req.body;

    try {
        // Validation
        if (!tenantId) {
            logger.warn('[WhatsApp API] Missing tenant', { correlationId });
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - no tenant found'
            });
        }

        if (!whatsappNumber) {
            logger.warn('[WhatsApp API] Missing whatsappNumber', { correlationId, tenantId });
            return res.status(400).json({
                success: false,
                error: 'WhatsApp number is required'
            });
        }

        // === DISTRIBUTED LOCK: Prevent concurrent instance creation for same tenant ===
        const lockKey = `instance:create:${tenantId}`;
        const lockAcquired = await redis.setnx(lockKey, '1');

        if (!lockAcquired) {
            logger.warn('[WhatsApp API] Concurrent creation blocked', { correlationId, tenantId });
            return res.status(409).json({
                success: false,
                error: 'Instance creation already in progress. Please wait.'
            });
        }

        // Set lock expiry (auto-release after 30s)
        await redis.expire(lockKey, 30);

        try {
            // Load tenant data
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    id: true,
                    whatsappInstanceId: true,
                    whatsappNumber: true,
                    businessName: true
                }
            });

            if (!tenant) {
                return res.status(404).json({
                    success: false,
                    error: 'Tenant not found'
                });
            }

            // === INSTANCE REUSE: Check if tenant already has a valid instance ===
            if (tenant.whatsappInstanceId) {
                logger.info('[WhatsApp API] Existing instance found, checking status', {
                    correlationId,
                    tenantId,
                    existingInstance: tenant.whatsappInstanceId
                });

                try {
                    const status = await evolutionAPI.getConnectionState(tenant.whatsappInstanceId);

                    // If instance is open or connecting, reuse it
                    if (status.state === 'open') {
                        logger.info('[WhatsApp API] Instance already connected, returning success', {
                            correlationId,
                            instanceName: tenant.whatsappInstanceId
                        });

                        return res.json({
                            success: true,
                            alreadyConnected: true,
                            instanceName: tenant.whatsappInstanceId,
                            message: 'WhatsApp is already connected'
                        });
                    } else if (status.state === 'connecting' || status.state === 'close') {
                        // Instance exists but needs reconnection, fetch new QR
                        logger.info('[WhatsApp API] Instance exists but disconnected, fetching new QR', {
                            correlationId,
                            instanceName: tenant.whatsappInstanceId,
                            state: status.state
                        });

                        // Try to get QR code from existing instance
                        const qrData = await evolutionAPI.getQRCode(tenant.whatsappInstanceId);

                        if (qrData && qrData.base64) {
                            return res.json({
                                success: true,
                                qrCode: qrData.base64,
                                instanceName: tenant.whatsappInstanceId,
                                reused: true
                            });
                        }
                    }
                } catch (instanceError: any) {
                    logger.warn('[WhatsApp API] Existing instance check failed, will create new', {
                        correlationId,
                        error: instanceError.message
                    });
                    // If instance doesn't exist in Evolution API, clean up and create new
                    await evolutionAPI.deleteInstance(tenant.whatsappInstanceId).catch(() => { });
                }
            }

            // === CREATE NEW INSTANCE: Deterministic naming without timestamp ===
            const businessName = tenant.businessName || 'business';
            const businessSlug = sanitizeBusinessName(businessName);
            const shortTenantId = tenantId.substring(0, 8);
            const instanceName = `salestra_${businessSlug}_${shortTenantId}`;
            const webhookUrl = `${process.env.BACKEND_URL || 'http://host.docker.internal:3000'}/api/webhooks-v2`;

            logger.info('[WhatsApp API] Creating new instance', {
                correlationId,
                tenantId,
                instanceName,
                whatsappNumber: `${whatsappNumber.substring(0, 4)}****`,
                webhookUrl
            });

            // Create instance in Evolution API
            await evolutionAPI.createInstance(instanceName, webhookUrl);

            logger.info('[WhatsApp API] Instance created in Evolution API', {
                correlationId,
                instanceName
            });

            // === DATABASE TRANSACTION: Only commit if QR fetch succeeds ===
            let qrData = null;
            let qrCode = null;

            try {
                // Wait for Evolution API initialization with exponential backoff
                logger.debug('[WhatsApp API] Fetching QR code with retry logic', {
                    correlationId,
                    instanceName
                });

                // Exponential backoff: 2s, 4s, 6s (total ~12s max)
                const delays = [2000, 4000, 6000];
                let lastError = null;

                for (let attempt = 0; attempt < delays.length; attempt++) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, delays[attempt]));

                        qrData = await evolutionAPI.getQRCode(instanceName);

                        if (qrData && qrData.base64) {
                            qrCode = qrData.base64;
                            logger.info('[WhatsApp API] QR code fetched successfully', {
                                correlationId,
                                instanceName,
                                attempt: attempt + 1
                            });
                            break;
                        }
                    } catch (error: any) {
                        lastError = error;
                        logger.warn('[WhatsApp API] QR fetch attempt failed', {
                            correlationId,
                            instanceName,
                            attempt: attempt + 1,
                            error: error.message
                        });
                    }
                }

                if (!qrCode) {
                    throw new Error(lastError?.message || 'Failed to fetch QR code after retries');
                }

                // === ATOMIC UPDATE: Only update DB after successful QR fetch ===
                await prisma.tenant.update({
                    where: { id: tenantId },
                    data: {
                        whatsappInstanceId: instanceName,
                        whatsappNumber
                    }
                });

                logger.info('[WhatsApp API] Database updated successfully', {
                    correlationId,
                    tenantId,
                    instanceName
                });

                const totalTime = Date.now() - startTime;

                return res.json({
                    success: true,
                    qrCode,
                    instanceName,
                    processingTime: totalTime
                });

            } catch (qrError: any) {
                // QR fetch failed - rollback by deleting instance
                logger.error('[WhatsApp API] QR fetch failed, rolling back instance', {
                    correlationId,
                    instanceName,
                    error: qrError.message
                });

                // Clean up Evolution API instance
                await evolutionAPI.deleteInstance(instanceName).catch((deleteError: any) => {
                    logger.error('[WhatsApp API] Rollback failed', {
                        correlationId,
                        instanceName,
                        error: deleteError.message
                    });
                });

                throw qrError;
            }

        } finally {
            // Release distributed lock
            await redis.del(lockKey);
        }

    } catch (error: any) {
        const totalTime = Date.now() - startTime;

        logger.error('[WhatsApp API] Instance creation failed', {
            correlationId,
            tenantId,
            error: {
                message: error.message,
                stack: error.stack
            },
            processingTime: totalTime
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to create WhatsApp instance. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/whatsapp/instance-details
 * Get instance details and connection status
 * 
 * NEW ENDPOINT: Required by frontend for polling connection status
 */
router.get('/instance-details', authenticate, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const tenantId = (req as AuthRequest).userId;

    logRequest(req, 'GET /instance-details', tenantId);

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                whatsappInstanceId: true,
                whatsappNumber: true
            }
        });

        // No instance found - return not connected
        if (!tenant || !tenant.whatsappInstanceId) {
            logger.debug('[WhatsApp API] No instance found for tenant', {
                correlationId: getCorrelationId(req),
                tenantId,
                hasInstance: false
            });

            logResponse(req, 'GET /instance-details', true, Date.now() - startTime, {
                connected: false
            });

            return res.json({
                success: true,
                connected: false,
                instance: null
            });
        }

        logger.debug('[WhatsApp API] Checking instance connection state', {
            correlationId: getCorrelationId(req),
            tenantId,
            instanceName: tenant.whatsappInstanceId
        });

        // Get connection status from Evolution API
        const status = await evolutionAPI.getConnectionState(tenant.whatsappInstanceId);
        const isConnected = status.state === 'open';

        const duration = Date.now() - startTime;
        logger.info('[WhatsApp API] Instance details retrieved', {
            correlationId: getCorrelationId(req),
            tenantId,
            instanceName: tenant.whatsappInstanceId,
            connected: isConnected,
            state: status.state,
            duration: `${duration}ms`
        });

        logResponse(req, 'GET /instance-details', true, duration, {
            connected: isConnected,
            state: status.state
        });

        return res.json({
            success: true,
            connected: isConnected,
            instance: {
                whatsappNumber: tenant.whatsappNumber,
                status: status.state,
                state: status.state
            }
        });

    } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('[WhatsApp API] Failed to get instance details', {
            correlationId: getCorrelationId(req),
            tenantId,
            error: error.message,
            duration: `${duration}ms`
        });

        logResponse(req, 'GET /instance-details', false, duration, {
            error: error.message
        });

        // Return not connected on error (graceful degradation)
        return res.json({
            success: true,
            connected: false,
            instance: null
        });
    }
});

/**
 * POST /api/whatsapp/logout
 * Logout WhatsApp instance (disconnect)
 * 
 * NEW ENDPOINT: Required by frontend disconnect button
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const tenantId = (req as AuthRequest).userId;

    logRequest(req, 'POST /logout', tenantId);

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                whatsappInstanceId: true,
                whatsappNumber: true
            }
        });

        if (!tenant?.whatsappInstanceId) {
            logger.warn('[WhatsApp API] Logout attempted but no instance found', {
                correlationId: getCorrelationId(req),
                tenantId
            });

            return res.json({
                success: true,
                message: 'No instance to disconnect'
            });
        }

        logger.info('[WhatsApp API] Logging out instance', {
            correlationId: getCorrelationId(req),
            tenantId,
            instanceName: tenant.whatsappInstanceId,
            whatsappNumber: tenant.whatsappNumber ? `${tenant.whatsappNumber.substring(0, 4)}****` : null
        });

        // Logout from Evolution API
        await evolutionAPI.logoutInstance(tenant.whatsappInstanceId);

        // Clear instance from database
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                whatsappInstanceId: null
                // Keep whatsappNumber for record
            }
        });

        const duration = Date.now() - startTime;
        logger.info('[WhatsApp API] Instance logged out successfully', {
            correlationId: getCorrelationId(req),
            tenantId,
            duration: `${duration}ms`
        });

        logResponse(req, 'POST /logout', true, duration);

        return res.json({ success: true });

    } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('[WhatsApp API] Failed to logout instance', {
            correlationId: getCorrelationId(req),
            tenantId,
            error: error.message,
            stack: error.stack,
            duration: `${duration}ms`
        });

        logResponse(req, 'POST /logout', false, duration, {
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to disconnect WhatsApp'
        });
    }
});

/**
 * GET /api/whatsapp/qr-code
 * Get QR code for authentication (standalone endpoint)
 * 
 * Note: create-instance now returns QR code, this is for refresh
 */
router.get('/qr-code', authenticate, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const tenantId = (req as AuthRequest).userId;

    logRequest(req, 'GET /qr-code', tenantId);

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { whatsappInstanceId: true }
        });

        if (!tenant || !tenant.whatsappInstanceId) {
            logger.warn('[WhatsApp API] QR code requested but no instance found', {
                correlationId: getCorrelationId(req),
                tenantId
            });

            return res.status(404).json({
                success: false,
                error: 'No WhatsApp instance found'
            });
        }

        logger.debug('[WhatsApp API] Fetching QR code', {
            correlationId: getCorrelationId(req),
            tenantId,
            instanceName: tenant.whatsappInstanceId
        });

        const qrData = await evolutionAPI.getQRCode(tenant.whatsappInstanceId);

        const duration = Date.now() - startTime;
        logResponse(req, 'GET /qr-code', true, duration);

        return res.json({
            success: true,
            data: qrData
        });

    } catch (error: any) {
        const duration = Date.now() - startTime;

        if (error.message === 'META_API_NO_QR_CODE_REQUIRED') {
            logger.info('[WhatsApp API] Meta API instance - no QR code needed', {
                correlationId: getCorrelationId(req),
                tenantId
            });

            return res.json({
                success: true,
                data: { status: 'connected', message: 'Meta API does not require QR code' }
            });
        }

        logger.error('[WhatsApp API] Failed to get QR code', {
            correlationId: getCorrelationId(req),
            tenantId,
            error: error.message,
            duration: `${duration}ms`
        });

        logResponse(req, 'GET /qr-code', false, duration, {
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to generate QR code'
        });
    }
});

/**
 * GET /api/whatsapp/connection-status
 * Check connection status (alternative to instance-details)
 */
router.get('/connection-status', authenticate, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const tenantId = (req as AuthRequest).userId;

    logRequest(req, 'GET /connection-status', tenantId);

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { whatsappInstanceId: true }
        });

        if (!tenant || !tenant.whatsappInstanceId) {
            logResponse(req, 'GET /connection-status', true, Date.now() - startTime, {
                connected: false
            });

            return res.json({
                success: true,
                data: { connected: false }
            });
        }

        const status = await evolutionAPI.getConnectionState(tenant.whatsappInstanceId);
        const isConnected = status.state === 'open';

        const duration = Date.now() - startTime;
        logResponse(req, 'GET /connection-status', true, duration, {
            connected: isConnected,
            state: status.state
        });

        return res.json({
            success: true,
            data: {
                connected: isConnected,
                state: status.state
            }
        });

    } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('[WhatsApp API] Failed to check connection status', {
            correlationId: getCorrelationId(req),
            tenantId,
            error: error.message,
            duration: `${duration}ms`
        });

        logResponse(req, 'GET /connection-status', false, duration);

        return res.json({
            success: true,
            data: { connected: false }
        });
    }
});

/**
 * DELETE /api/whatsapp/instance
 * Delete WhatsApp instance permanently
 */
router.delete('/instance', authenticate, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const tenantId = (req as AuthRequest).userId;

    logRequest(req, 'DELETE /instance', tenantId);

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                whatsappInstanceId: true,
                whatsappNumber: true
            }
        });

        if (tenant?.whatsappInstanceId) {
            logger.info('[WhatsApp API] Deleting instance', {
                correlationId: getCorrelationId(req),
                tenantId,
                instanceName: tenant.whatsappInstanceId
            });

            await evolutionAPI.deleteInstance(tenant.whatsappInstanceId);

            await prisma.tenant.update({
                where: { id: tenantId },
                data: { whatsappInstanceId: null }
            });

            const duration = Date.now() - startTime;
            logger.info('[WhatsApp API] Instance deleted successfully', {
                correlationId: getCorrelationId(req),
                tenantId,
                duration: `${duration}ms`
            });

            logResponse(req, 'DELETE /instance', true, duration);
        } else {
            logger.debug('[WhatsApp API] Delete requested but no instance found', {
                correlationId: getCorrelationId(req),
                tenantId
            });
        }

        return res.json({ success: true });

    } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('[WhatsApp API] Failed to delete instance', {
            correlationId: getCorrelationId(req),
            tenantId,
            error: error.message,
            stack: error.stack,
            duration: `${duration}ms`
        });

        logResponse(req, 'DELETE /instance', false, duration, {
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to delete instance'
        });
    }
});

export default router;
