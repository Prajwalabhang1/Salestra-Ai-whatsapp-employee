import Queue, { Job, JobOptions } from 'bull';
import logger from '../../lib/logger.js';

/**
 * Priority-based Message Queue for Fast Processing
 * 
 * Features:
 * - Multiple priority levels
 * - Automatic priority assignment
 * - SLA tracking
 * - Queue health monitoring
 */

export enum MessagePriority {
    URGENT = 1,      // First message from customer (< 1.5s target)
    HIGH = 2,        // Quick inquiry < 10 words (< 2s target)
    NORMAL = 3,      // Regular message (< 2.5s target)
    LOW = 4          // Long conversation > 10 messages (< 5s target)
}

export interface PriorityMessageJob {
    tenantId: string;
    conversationId: string;
    customerPhone: string;
    messageText: string;
    whatsappInstanceId: string;
    whatsappMessageId: string;

    // Priority metadata
    priority: MessagePriority;
    isFirstMessage: boolean;
    conversationLength: number;
    enqueuedAt: number;
}

interface QueueMetrics {
    processed: number;
    failed: number;
    active: number;
    waiting: number;
    avgProcessTime: number;
    slaBreaches: number;
}

class PriorityMessageQueue {
    private queue: Queue<PriorityMessageJob>;
    private metrics: QueueMetrics = {
        processed: 0,
        failed: 0,
        active: 0,
        waiting: 0,
        avgProcessTime: 0,
        slaBreaches: 0
    };

    constructor(redisConfig: any) {
        this.queue = new Queue<PriorityMessageJob>('priority-messages', {
            redis: redisConfig,
            defaultJobOptions: {
                attempts: 1, // REDUCED from 3: Prevent duplicate AI responses on retry
                backoff: {
                    type: 'exponential',
                    delay: 2000 // 2s (not used with attempts: 1, but kept for consistency)
                },
                removeOnComplete: 100, // Keep last 100 completed jobs
                removeOnFail: 50       // Keep last 50 failed jobs
            }
        });

        this.setupEventListeners();
    }

    /**
     * Add message to queue with automatic priority assignment
     */
    async queueMessage(data: Omit<PriorityMessageJob, 'priority' | 'enqueuedAt'>): Promise<Job<PriorityMessageJob>> {
        const priority = this.determinePriority(data);
        const slaTarget = this.getSLATarget(priority);

        const jobData: PriorityMessageJob = {
            ...data,
            priority,
            enqueuedAt: Date.now()
        };

        const jobOptions: JobOptions = {
            priority,
            timeout: slaTarget * 2, // Timeout at 2x SLA
            jobId: data.whatsappMessageId, // 🔒 DEDUPLICATION: Use Message ID as Job ID
            removeOnComplete: true, // Keep clean
            removeOnFail: 50
        };

        logger.info(`[Queue] Queueing message (Priority: ${MessagePriority[priority]}, SLA: ${slaTarget}ms, JobID: ${data.whatsappMessageId})`);

        return await this.queue.add(jobData, jobOptions);
    }

    /**
     * Determine message priority based on context
     */
    private determinePriority(data: Omit<PriorityMessageJob, 'priority' | 'enqueuedAt'>): MessagePriority {
        // URGENT: First message from customer
        if (data.isFirstMessage) {
            return MessagePriority.URGENT;
        }

        // HIGH: Quick inquiry (< 10 words)
        const wordCount = data.messageText.trim().split(/\s+/).length;
        if (wordCount <= 10) {
            return MessagePriority.HIGH;
        }

        // LOW: Long ongoing conversation (> 10 messages)
        if (data.conversationLength > 10) {
            return MessagePriority.LOW;
        }

        // NORMAL: Everything else
        return MessagePriority.NORMAL;
    }

    /**
     * Get SLA target in milliseconds
     */
    private getSLATarget(priority: MessagePriority): number {
        switch (priority) {
            case MessagePriority.URGENT: return 1500;  // 1.5s
            case MessagePriority.HIGH: return 2000;    // 2s
            case MessagePriority.NORMAL: return 2500;  // 2.5s
            case MessagePriority.LOW: return 5000;     // 5s
            default: return 3000;
        }
    }

    /**
     * Process messages with worker function
     */
    process(concurrency: number, processor: (job: Job<PriorityMessageJob>) => Promise<any>): void {
        this.queue.process(concurrency, async (job: Job<PriorityMessageJob>) => {
            const startTime = Date.now();
            const slaTarget = this.getSLATarget(job.data.priority);

            try {
                logger.info(`[Queue] Processing job ${job.id} (Priority: ${MessagePriority[job.data.priority]})`);

                const result = await processor(job);

                const processTime = Date.now() - startTime;
                this.updateMetrics(processTime, slaTarget);

                logger.info(`[Queue] ✅ Completed job ${job.id} in ${processTime}ms (SLA: ${slaTarget}ms)`);

                return result;
            } catch (error: any) {
                const processTime = Date.now() - startTime;
                logger.error(`[Queue] ❌ Failed job ${job.id} after ${processTime}ms: ${error.message}`);

                this.metrics.failed++;
                throw error;
            }
        });
    }

    /**
     * Setup event listeners for monitoring
     */
    private setupEventListeners(): void {
        this.queue.on('completed', (job) => {
            logger.debug(`[Queue] Job ${job.id} completed`);
        });

        this.queue.on('failed', (job, err) => {
            logger.error(`[Queue] Job ${job?.id} failed: ${err.message}`);
        });

        this.queue.on('stalled', (job) => {
            if (job) logger.warn(`[Queue] Job ${job.id} stalled`);
        });

        this.queue.on('error', (error: Error) => {
            logger.error(`[Queue] Queue error: ${error.message}`);
        });

        this.queue.on('active', (job) => {
            logger.debug(`[Queue] Job ${job.id} started`);
        });
    }

    /**
     * Update performance metrics
     */
    private updateMetrics(processTime: number, slaTarget: number): void {
        this.metrics.processed++;

        // Update average processing time
        const total = this.metrics.processed;
        this.metrics.avgProcessTime =
            ((this.metrics.avgProcessTime * (total - 1)) + processTime) / total;

        // Track SLA breaches
        if (processTime > slaTarget) {
            this.metrics.slaBreaches++;
            logger.warn(`[Queue] ⚠️ SLA breach: ${processTime}ms > ${slaTarget}ms`);
        }
    }

    /**
     * Get queue health and metrics
     */
    async getHealth(): Promise<{
        isHealthy: boolean;
        metrics: QueueMetrics;
        queueCounts: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
        };
    }> {
        const counts = await this.queue.getJobCounts();

        const isHealthy = counts.waiting < 100 && counts.failed < 10;

        return {
            isHealthy,
            metrics: this.metrics,
            queueCounts: counts
        };
    }

    /**
     * Get queue stats for monitoring
     */
    async getStats() {
        const health = await this.getHealth();

        return {
            ...health,
            slaCompliance: this.metrics.processed > 0
                ? ((this.metrics.processed - this.metrics.slaBreaches) / this.metrics.processed) * 100
                : 100,
            errorRate: this.metrics.processed > 0
                ? (this.metrics.failed / this.metrics.processed) * 100
                : 0
        };
    }

    /**
     * Pause queue processing
     */
    async pause(): Promise<void> {
        await this.queue.pause();
        logger.info('[Queue] Queue paused');
    }

    /**
     * Resume queue processing
     */
    async resume(): Promise<void> {
        await this.queue.resume();
        logger.info('[Queue] Queue resumed');
    }

    /**
     * Clean old jobs
     */
    async clean(grace: number = 3600000): Promise<void> {
        await this.queue.clean(grace, 'completed');
        await this.queue.clean(grace, 'failed');
        logger.info(`[Queue] Cleaned jobs older than ${grace}ms`);
    }

    /**
     * Get underlying Bull queue (for advanced operations)
     */
    getQueue(): Queue<PriorityMessageJob> {
        return this.queue;
    }
}

// Export singleton instance
export let priorityMessageQueue: PriorityMessageQueue;

export async function initializePriorityQueue(redisConfig: any): Promise<void> {
    priorityMessageQueue = new PriorityMessageQueue(redisConfig);
    logger.info('✅ Priority message queue initialized');
}

export default PriorityMessageQueue;
