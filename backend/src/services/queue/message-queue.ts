import Queue from 'bull';
import redis from '../../lib/redis.js';
import logger from '../../lib/logger.js';

export interface MessageJob {
    tenantId: string;
    conversationId: string;
    customerPhone: string;
    messageText: string;
    whatsappInstanceId: string;
}

/**
 * Parse Redis URL safely
 */
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

// Create message processing queue
export const messageQueue = new Queue<MessageJob>('message-processing', {
    redis: parseRedisConfig(process.env.REDIS_URL),
    limiter: {
        max: 100, // Max 100 jobs
        duration: 60000, // Per 60 seconds (1 minute)
        groupKey: 'tenantId' // Rate limit per tenant
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
    },
});

/**
 * Add message to processing queue
 */
export async function queueMessage(data: MessageJob): Promise<void> {
    try {
        await messageQueue.add(data, {
            priority: 1, // Normal priority
        });
        logger.debug(`Queued message from ${data.customerPhone} for tenant ${data.tenantId}`);
    } catch (error) {
        logger.error(`Error queuing message: ${error}`);
        throw error;
    }
}

/**
 * Queue event handlers
 */
messageQueue.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
});

messageQueue.on('failed', async (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);

    // Check if this was the final attempt (max retries exceeded)
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error(`[DLQ] Job ${job.id} exceeded max retries (${job.attemptsMade}/${job.opts.attempts})`);

        // Move to Dead Letter Queue
        try {
            const { dlqService } = await import('./dead-letter-queue.js');
            await dlqService.addToDeadLetter(
                job.data,
                err,
                job.attemptsMade,
                String(job.id)
            );
            logger.warn(`[DLQ] Job ${job.id} moved to Dead Letter Queue`);
        } catch (dlqError: any) {
            logger.error(`[DLQ] Failed to add job to DLQ: ${dlqError.message}`);
        }
    }
});

messageQueue.on('stalled', (job) => {
    logger.warn(`Job ${job.id} stalled - will be retried automatically`);
});

/**
 * Get queue statistics
 */
export async function getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        messageQueue.getWaitingCount(),
        messageQueue.getActiveCount(),
        messageQueue.getCompletedCount(),
        messageQueue.getFailedCount(),
        messageQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
}

export default messageQueue;
