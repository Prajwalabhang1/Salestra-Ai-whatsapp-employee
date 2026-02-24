import { Router } from 'express';
import logger from '../lib/logger.js';

const router = Router();

// Webhook health tracking
const webhookHealth = new Map<string, { lastReceived: Date, count: number }>();

// Track webhook received
export function trackWebhookReceived(instanceName: string) {
    const current = webhookHealth.get(instanceName);
    webhookHealth.set(instanceName, {
        lastReceived: new Date(),
        count: (current?.count || 0) + 1
    });
}

/**
 * GET /api/webhooks/health
 * Check webhook health status
 */
router.get('/health', (req, res) => {
    const now = Date.now();
    const healthStatus: any = {
        status: 'healthy',
        instances: {},
        summary: {
            totalInstances: webhookHealth.size,
            healthyInstances: 0,
            warningInstances: 0,
            criticalInstances: 0
        }
    };

    // Check each instance
    for (const [instance, data] of webhookHealth) {
        const millisSinceLastWebhook = now - data.lastReceived.getTime();
        const minutesSince = Math.floor(millisSinceLastWebhook / 60000);

        let instanceStatus = 'healthy';
        if (millisSinceLastWebhook > 10 * 60 * 1000) { // 10 minutes
            instanceStatus = 'critical';
            healthStatus.status = 'degraded';
            healthStatus.summary.criticalInstances++;
        } else if (millisSinceLastWebhook > 5 * 60 * 1000) { // 5 minutes
            instanceStatus = 'warning';
            if (healthStatus.status === 'healthy') {
                healthStatus.status = 'warning';
            }
            healthStatus.summary.warningInstances++;
        } else {
            healthStatus.summary.healthyInstances++;
        }

        healthStatus.instances[instance] = {
            status: instanceStatus,
            lastReceived: data.lastReceived.toISOString(),
            minutesSinceLastWebhook: minutesSince,
            totalWebhooksReceived: data.count
        };
    }

    res.json(healthStatus);
});

/**
 * GET /api/webhooks/stats
 * Get webhook statistics
 */
router.get('/stats', (req, res) => {
    const stats = {
        totalInstances: webhookHealth.size,
        instances: Array.from(webhookHealth.entries()).map(([instance, data]) => ({
            instance,
            lastReceived: data.lastReceived.toISOString(),
            totalReceived: data.count,
            minutesSinceLastWebhook: Math.floor((Date.now() - data.lastReceived.getTime()) / 60000)
        }))
    };

    res.json(stats);
});

export { webhookHealth };
export default router;
