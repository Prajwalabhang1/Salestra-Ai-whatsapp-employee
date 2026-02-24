/**
 * Enhanced Health Check Endpoint
 * Provides comprehensive system health and status information
 */

import { Router, Request, Response } from 'express';
import { getMetrics } from '../lib/metrics.js';
import { logger } from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const router = Router();

/**
 * GET /metrics  
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req: Request, res: Response) => {
    try {
        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error: any) {
        logger.error('Failed to generate metrics', {
            error: { message: error.message, stack: error.stack }
        });
        res.status(500).json({ error: 'Failed to generate metrics' });
    }
});

/**
 * GET /
 * Comprehensive health check
 */
router.get('/', async (req: Request, res: Response) => {
    const healthData: any = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };

    try {
        // Check database
        try {
            await prisma.$queryRaw`SELECT 1`;
            healthData.database = { status: 'healthy', type: 'postgresql' };
        } catch (dbError: any) {
            healthData.database = { status: 'unhealthy', error: dbError.message };
            healthData.status = 'degraded';
        }

        // Check Redis
        try {
            const pong = await redis.ping();
            healthData.redis = { status: pong === 'PONG' ? 'healthy' : 'unhealthy' };
        } catch (redisError: any) {
            healthData.redis = { status: 'unhealthy', error: redisError.message };
            healthData.status = 'degraded';
        }

        // Worker status (set in index.ts)
        healthData.workerStatus = (req.app as any).workerStatus || 'unknown';
        if (healthData.workerStatus !== 'active-v1' && healthData.workerStatus !== 'active-v2') {
            healthData.status = 'degraded';
        }

        // Check queue depth (if available)
        try {
            const queueKeys = await redis.keys('bull:priority-messages:*');
            healthData.queueDepth = queueKeys.length;
        } catch {
            healthData.queueDepth = 'unknown';
        }

        // Send response with appropriate status code
        const statusCode = healthData.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthData);

    } catch (error: any) {
        logger.error('Health check failed', {
            error: { message: error.message, stack: error.stack }
        });

        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * GET /live
 * Kubernetes liveness probe (is the server running?)
 */
router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({ status: 'alive' });
});

/**
 * GET /ready
 * Kubernetes readiness probe (can the server handle traffic?)
 */
router.get('/ready', async (req: Request, res: Response) => {
    try {
        // Quick database check
        await prisma.$queryRaw`SELECT 1`;

        // Check worker is running
        const workerStatus = (req.app as any).workerStatus;
        const isReady = workerStatus === 'active-v1' || workerStatus === 'active-v2';

        if (isReady) {
            res.status(200).json({ status: 'ready' });
        } else {
            res.status(503).json({ status: 'not-ready', reason: 'worker-not-active' });
        }
    } catch (error) {
        res.status(503).json({ status: 'not-ready', reason: 'database-unavailable' });
    }
});

export default router;
