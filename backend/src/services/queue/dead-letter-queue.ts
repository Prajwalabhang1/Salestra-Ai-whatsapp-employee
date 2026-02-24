/**
 * Dead Letter Queue (DLQ) Service
 * Handles permanently failed messages for manual review/retry
 */

import Queue from 'bull';
import logger from '../../lib/logger.js';
import { isFeatureEnabled } from '../../lib/secrets.js';
import prisma from '../../lib/prisma.js';

// ============================================
// TYPES
// ============================================

export interface DeadLetterJob {
    originalJobData: {
        tenantId: string;
        conversationId: string;
        customerPhone: string;
        messageText: string;
        whatsappInstanceId: string;
    };
    error: {
        message: string;
        stack?: string;
    };
    failureCount: number;
    firstFailure: string;
    lastFailure: string;
    originalJobId?: string;
}

export interface DLQStats {
    waiting: number;
    failed: number;
    completed: number;
    total: number;
}

// ============================================
// REDIS CONFIG
// ============================================

function parseRedisConfig(url?: string) {
    const redisUrl = url || 'redis://localhost:6379';

    try {
        const urlObj = new URL(redisUrl);
        return {
            host: urlObj.hostname,
            port: parseInt(urlObj.port) || 6379,
            password: urlObj.password || undefined,
            db: urlObj.pathname ? parseInt(urlObj.pathname.slice(1)) : 0,
        };
    } catch (error) {
        logger.error(`Invalid REDIS_URL: ${redisUrl}`);
        throw new Error('REDIS_URL must be a valid URL (e.g., redis://localhost:6379)');
    }
}

// ============================================
// DLQ QUEUE
// ============================================

export const deadLetterQueue = new Queue<DeadLetterJob>('dead-letter-queue', {
    redis: parseRedisConfig(process.env.REDIS_URL),
    defaultJobOptions: {
        attempts: 1,  // DLQ items don't auto-retry
        removeOnComplete: false,  // Keep for manual review
        removeOnFail: false,      // Keep failed DLQ items too
    },
});

// ============================================
// DLQ SERVICE
// ============================================

class DeadLetterQueueService {
    private enabled: boolean;

    constructor() {
        this.enabled = isFeatureEnabled('ENABLE_DLQ');
        this.setupHandlers();
    }

    /**
     * Setup queue event handlers
     */
    private setupHandlers(): void {
        deadLetterQueue.on('completed', (job) => {
            logger.info(`[DLQ] Job ${job.id} marked as completed (processed manually)`);
        });

        deadLetterQueue.on('failed', (job, err) => {
            logger.error(`[DLQ] Job ${job?.id} failed in DLQ: ${err.message}`);
        });

        deadLetterQueue.on('error', (error) => {
            logger.error(`[DLQ] Queue error: ${error.message}`);
        });
    }

    /**
     * Add a failed job to the Dead Letter Queue
     */
    async addToDeadLetter(
        originalJobData: DeadLetterJob['originalJobData'],
        error: Error,
        failureCount: number,
        originalJobId?: string
    ): Promise<void> {
        if (!this.enabled) {
            logger.debug('[DLQ] Dead Letter Queue disabled, skipping');
            return;
        }

        const now = new Date().toISOString();

        const dlqJob: DeadLetterJob = {
            originalJobData,
            error: {
                message: error.message,
                stack: error.stack,
            },
            failureCount,
            firstFailure: now,
            lastFailure: now,
            originalJobId,
        };

        try {
            const job = await deadLetterQueue.add(dlqJob, {
                jobId: `dlq_${originalJobData.conversationId}_${Date.now()}`,
            });

            logger.warn(`[DLQ] Added failed message to DLQ: ${job.id}`);
            logger.warn(`[DLQ] Original conversation: ${originalJobData.conversationId}`);
            logger.warn(`[DLQ] Customer: ${originalJobData.customerPhone}`);
            logger.warn(`[DLQ] Error: ${error.message}`);

            // Also log to database for persistence
            await this.logToDatabaseAsync(dlqJob);

        } catch (err: any) {
            logger.error(`[DLQ] Failed to add to DLQ: ${err.message}`);
        }
    }

    /**
     * Log DLQ entry to database for persistence (async, non-blocking)
     */
    private async logToDatabaseAsync(dlqJob: DeadLetterJob): Promise<void> {
        try {
            await prisma.executionLog.create({
                data: {
                    executionId: `dlq_${Date.now()}`,
                    tenantId: dlqJob.originalJobData.tenantId,
                    conversationId: dlqJob.originalJobData.conversationId,
                    inputMessage: dlqJob.originalJobData.messageText,
                    status: 'dead_letter',
                    errorMessage: `DLQ: ${dlqJob.error.message} (after ${dlqJob.failureCount} failures)`,
                    toolsUsed: {
                        dlqJobId: dlqJob.originalJobId,
                        failureCount: dlqJob.failureCount,
                    } as any,
                },
            });
        } catch (err: any) {
            logger.error(`[DLQ] Failed to log to database: ${err.message}`);
        }
    }

    /**
     * Get all jobs in the DLQ
     */
    async getDeadLetterJobs(limit: number = 50): Promise<DeadLetterJob[]> {
        const jobs = await deadLetterQueue.getWaiting(0, limit);
        return jobs.map(job => job.data);
    }

    /**
     * Retry a specific DLQ job (re-queue to main queue)
     */
    async retryJob(jobId: string): Promise<boolean> {
        try {
            const job = await deadLetterQueue.getJob(jobId);

            if (!job) {
                logger.warn(`[DLQ] Job ${jobId} not found`);
                return false;
            }

            // Import the main queue and re-add the job
            const { queueMessage } = await import('./message-queue.js');
            await queueMessage(job.data.originalJobData);

            // Remove from DLQ
            await job.remove();

            logger.info(`[DLQ] Retried job ${jobId} - moved back to main queue`);
            return true;

        } catch (err: any) {
            logger.error(`[DLQ] Failed to retry job ${jobId}: ${err.message}`);
            return false;
        }
    }

    /**
     * Discard a DLQ job (acknowledge and remove)
     */
    async discardJob(jobId: string): Promise<boolean> {
        try {
            const job = await deadLetterQueue.getJob(jobId);

            if (!job) {
                logger.warn(`[DLQ] Job ${jobId} not found`);
                return false;
            }

            await job.remove();
            logger.info(`[DLQ] Discarded job ${jobId}`);
            return true;

        } catch (err: any) {
            logger.error(`[DLQ] Failed to discard job ${jobId}: ${err.message}`);
            return false;
        }
    }

    /**
     * Get DLQ statistics
     */
    async getStats(): Promise<DLQStats> {
        const [waiting, failed, completed] = await Promise.all([
            deadLetterQueue.getWaitingCount(),
            deadLetterQueue.getFailedCount(),
            deadLetterQueue.getCompletedCount(),
        ]);

        return {
            waiting,
            failed,
            completed,
            total: waiting + failed + completed,
        };
    }

    /**
     * Clear all DLQ jobs (use with caution!)
     */
    async clearAll(): Promise<number> {
        const jobs = await deadLetterQueue.getWaiting();
        let cleared = 0;

        for (const job of jobs) {
            await job.remove();
            cleared++;
        }

        logger.warn(`[DLQ] Cleared ${cleared} jobs from DLQ`);
        return cleared;
    }

    /**
     * Check if DLQ is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const dlqService = new DeadLetterQueueService();
export default dlqService;
