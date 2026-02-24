import logger from '../../lib/logger.js';
import { evolutionAPI } from './evolution.service.js';
import prisma from '../../lib/prisma.js';

/**
 * WhatsApp Instance Cleanup Service
 * 
 * Prevents accumulation of stuck/orphaned instances in Evolution API
 * Runs periodic maintenance to keep Evolution API healthy
 */
export class CleanupService {
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;

    /**
     * Start periodic cleanup
     * @param intervalMinutes How often to run cleanup (default: 15 minutes)
     */
    start(intervalMinutes: number = 15) {
        if (this.isRunning) {
            logger.warn('[Cleanup] Service already running');
            return;
        }

        this.isRunning = true;
        const intervalMs = intervalMinutes * 60 * 1000;

        logger.info(`[Cleanup] Starting cleanup service (interval: ${intervalMinutes} minutes)`);

        // Run immediately on startup
        this.runCleanup();

        // Then run periodically
        this.cleanupInterval = setInterval(() => {
            this.runCleanup();
        }, intervalMs);
    }

    /**
     * Stop periodic cleanup
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.isRunning = false;
        logger.info('[Cleanup] Cleanup service stopped');
    }

    /**
     * Run cleanup logic
     */
    private async runCleanup() {
        logger.info('[Cleanup] Running instance cleanup...');

        try {
            await Promise.all([
                this.cleanupStaleInstances(),
                this.cleanupOrphanedInstances()
            ]);

            logger.info('[Cleanup] ✓ Cleanup completed successfully');
        } catch (error: any) {
            logger.error('[Cleanup] Cleanup failed:', error.message);
        }
    }

    /**
     * Delete instances stuck in "connecting" state for > 5 minutes
     */
    private async cleanupStaleInstances() {
        try {
            logger.debug('[Cleanup] Checking for stale instances...');

            const allInstances = await evolutionAPI.fetchInstances();

            if (!allInstances || allInstances.length === 0) {
                logger.debug('[Cleanup] No instances found');
                return;
            }

            const staleInstances = allInstances.filter((inst: any) => {
                const state = inst.instance?.state || inst.state;
                const instanceName = inst.instance?.instanceName || inst.instanceName;

                // Consider an instance stale if it's been connecting for too long
                // Evolution API doesn't expose creation time, so we use a simple heuristic
                return state === 'close' || state === 'connecting';
            });

            if (staleInstances.length > 0) {
                logger.info(`[Cleanup] Found ${staleInstances.length} potentially stale instances`);

                for (const inst of staleInstances) {
                    const instanceName = inst.instance?.instanceName || inst.instanceName;

                    try {
                        // Check if instance exists in our database
                        const tenant = await prisma.tenant.findFirst({
                            where: { whatsappInstanceId: instanceName },
                            select: { id: true, updatedAt: true }
                        });

                        if (tenant) {
                            // Instance exists in DB - check if it's stuck
                            const instanceAge = Date.now() - (tenant.updatedAt?.getTime() || 0);

                            if (instanceAge > 300000) { // 5 minutes
                                logger.warn(`[Cleanup] Deleting stale instance: ${instanceName} (age: ${Math.floor(instanceAge / 1000)}s)`);
                                await evolutionAPI.deleteInstance(instanceName);

                                // Clear from database
                                await prisma.tenant.update({
                                    where: { id: tenant.id },
                                    data: { whatsappInstanceId: null, whatsappNumber: null }
                                });
                            }
                        }
                    } catch (error: any) {
                        logger.warn(`[Cleanup] Failed to process ${instanceName}:`, error.message);
                    }
                }
            }

        } catch (error: any) {
            logger.error('[Cleanup] Stale instance cleanup failed:', error.message);
        }
    }

    /**
     * Delete instances in Evolution API that don't exist in our database
     */
    private async cleanupOrphanedInstances() {
        try {
            logger.debug('[Cleanup] Checking for orphaned instances...');

            const allInstances = await evolutionAPI.fetchInstances();

            if (!allInstances || allInstances.length === 0) {
                return;
            }

            // Get all instance IDs from our database
            const tenants = await prisma.tenant.findMany({
                where: {
                    whatsappInstanceId: { not: null }
                },
                select: { whatsappInstanceId: true }
            });

            const knownInstanceIds = new Set(
                tenants
                    .map(t => t.whatsappInstanceId)
                    .filter((id): id is string => id !== null)
            );

            logger.debug(`[Cleanup] Known instances in database: ${knownInstanceIds.size}`);

            const orphanedInstances = allInstances.filter((inst: any) => {
                const instanceName = inst.instance?.instanceName || inst.instanceName;
                return instanceName && !knownInstanceIds.has(instanceName);
            });

            if (orphanedInstances.length > 0) {
                logger.info(`[Cleanup] Found ${orphanedInstances.length} orphaned instances`);

                for (const inst of orphanedInstances) {
                    const instanceName = inst.instance?.instanceName || inst.instanceName;

                    try {
                        logger.warn(`[Cleanup] Deleting orphaned instance: ${instanceName}`);
                        await evolutionAPI.deleteInstance(instanceName);
                    } catch (error: any) {
                        logger.warn(`[Cleanup] Failed to delete orphaned ${instanceName}:`, error.message);
                    }
                }
            }

        } catch (error: any) {
            logger.error('[Cleanup] Orphaned instance cleanup failed:', error.message);
        }
    }
}

export const cleanupService = new CleanupService();
export default cleanupService;
