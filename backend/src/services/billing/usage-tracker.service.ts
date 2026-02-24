import prisma from '../../lib/prisma.js';
import logger from '../../lib/logger.js';

/**
 * Track message usage for tenant
 */
export async function trackMessageUsage(tenantId: string): Promise<boolean> {
    try {
        const subscription = await prisma.subscription.findUnique({
            where: { tenantId },
        });

        if (!subscription) {
            logger.warn(`No subscription found for tenant ${tenantId}`);
            return true; // Allow if no subscription (grace period)
        }

        // Increment messages used
        await prisma.subscription.update({
            where: { tenantId },
            data: {
                messagesUsed: {
                    increment: 1,
                },
            },
        });

        logger.debug(`Tracked message usage for tenant ${tenantId}`);
        return true;
    } catch (error) {
        logger.error(`Error tracking message usage: ${error}`);
        return true; // Don't block on tracking errors
    }
}

/**
 * Atomically check and increment message usage
 * Returns true if quota was available and incremented, false otherwise
 */
export async function checkAndIncrementQuota(tenantId: string): Promise<boolean> {
    try {
        // Atomic update: only updates if less than limit
        // We use updateMany because it allows filtering by current values (optimistic locking pattern)
        const result = await prisma.subscription.updateMany({
            where: {
                tenantId,
                status: { in: ['active', 'trial'] },
                messagesUsed: {
                    lt: prisma.subscription.fields.messageLimit
                }
            },
            data: {
                messagesUsed: {
                    increment: 1
                }
            }
        });

        if (result.count > 0) {
            logger.debug(`[Quota] Atomically incremented usage for tenant ${tenantId}`);
            return true;
        }

        // If update failed, check why (warn only)
        const sub = await prisma.subscription.findUnique({ where: { tenantId } });
        if (sub) {
            if (sub.messagesUsed >= sub.messageLimit) {
                logger.warn(`[Quota] Limit exceeded for tenant ${tenantId}: ${sub.messagesUsed}/${sub.messageLimit}`);
            } else if (!['active', 'trial'].includes(sub.status)) {
                logger.warn(`[Quota] Subscription inactive for tenant ${tenantId}: ${sub.status}`);
            }
        } else {
            // Grace period for no subscription (optional, depending on business logic)
            // For strict production, this should likely be false, but keeping consistent with previous logic
            logger.warn(`[Quota] No subscription for tenant ${tenantId} - allowing with grace`);
            return true;
        }

        return false;
    } catch (error) {
        logger.error(`Error in checkAndIncrementQuota: ${error}`);
        // Fail open or closed? "True" means free usage on error. "False" means service outage.
        // Usually Fail Open is better for user experience unless critical.
        return true;
    }
}

/**
 * Check if tenant has available quota (Read-only)
 */
export async function checkQuota(tenantId: string): Promise<boolean> {
    try {
        const subscription = await prisma.subscription.findUnique({
            where: { tenantId },
        });

        if (!subscription) {
            // No subscription found - allow with warning
            logger.warn(`No subscription for tenant ${tenantId} - allowing with grace`);
            return true;
        }

        // Check if subscription is active
        if (subscription.status !== 'active' && subscription.status !== 'trial') {
            logger.warn(`Subscription inactive for tenant ${tenantId}: ${subscription.status}`);
            return false;
        }

        // Check if limit exceeded
        if (subscription.messagesUsed >= subscription.messageLimit) {
            logger.warn(`Message limit exceeded for tenant ${tenantId}: ${subscription.messagesUsed}/${subscription.messageLimit}`);
            return false;
        }

        return true;
    } catch (error) {
        logger.error(`Error checking quota: ${error}`);
        return true; // Fail open to avoid disruption
    }
}

/**
 * Get subscription details
 */
export async function getSubscription(tenantId: string) {
    try {
        const subscription = await prisma.subscription.findUnique({
            where: { tenantId },
        });

        return subscription;
    } catch (error) {
        logger.error(`Error getting subscription: ${error}`);
        return null;
    }
}

/**
 * Reset monthly usage (called by cron job)
 */
export async function resetMonthlyUsage() {
    try {
        const now = new Date();

        // Find all subscriptions where period has ended
        const subscriptions = await prisma.subscription.findMany({
            where: {
                currentPeriodEnd: {
                    lte: now,
                },
            },
        });

        for (const sub of subscriptions) {
            await prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    messagesUsed: 0,
                    currentPeriodStart: now,
                    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days
                },
            });
        }

        logger.info(`Reset usage for ${subscriptions.length} subscriptions`);
        return subscriptions.length;
    } catch (error) {
        logger.error(`Error resetting monthly usage: ${error}`);
        return 0;
    }
}

/**
 * Create default subscription for new tenant
 */
export async function createDefaultSubscription(tenantId: string) {
    try {
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

        await prisma.subscription.create({
            data: {
                tenantId,
                plan: 'starter',
                status: 'trial',
                messageLimit: 1000,
                messagesUsed: 0,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
            },
        });

        logger.info(`Created default subscription for tenant ${tenantId}`);
        return true;
    } catch (error) {
        logger.error(`Error creating default subscription: ${error}`);
        return false;
    }
}
