import { Redis } from 'ioredis';
import logger from './logger.js';

/**
 * Smart Cache Layer for High-Performance Data Access
 * 
 * Features:
 * - Redis-backed caching with TTL
 * - Automatic cache warming
 * - Intelligent invalidation
 * - Performance metrics
 */

interface CacheOptions {
    ttl?: number;           // Time to live in seconds (default: 300)
    refresh?: boolean;      // Force refresh from source
    warming?: boolean;      // Enable cache warming
}

interface CacheMetrics {
    hits: number;
    misses: number;
    errors: number;
    avgFetchTime: number;
}

class SmartCache {
    private redis: Redis;
    private metrics: Map<string, CacheMetrics> = new Map();
    private warmingInProgress: Set<string> = new Set();

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * Get value from cache or fetch from source
     */
    async get<T>(
        key: string,
        fetchFn: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<T> {
        const { ttl = 300, refresh = false } = options;
        const startTime = Date.now();

        try {
            // Force refresh
            if (refresh) {
                logger.debug(`[Cache] Force refresh: ${key}`);
                return await this.fetchAndCache(key, fetchFn, ttl);
            }

            // Try cache first
            const cached = await this.redis.get(key);

            if (cached) {
                this.recordHit(key, Date.now() - startTime);
                logger.debug(`[Cache] HIT: ${key}`);
                return JSON.parse(cached);
            }

            // Cache miss - fetch and cache
            this.recordMiss(key);
            logger.debug(`[Cache] MISS: ${key}`);
            return await this.fetchAndCache(key, fetchFn, ttl);

        } catch (error: any) {
            this.recordError(key);
            logger.error(`[Cache] Error for ${key}: ${error.message}`);

            // Fallback to direct fetch
            return await fetchFn();
        }
    }

    /**
     * Fetch from source and cache result
     */
    private async fetchAndCache<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl: number
    ): Promise<T> {
        const value = await fetchFn();

        // Cache the result (async, don't wait)
        this.redis
            .setex(key, ttl, JSON.stringify(value))
            .catch(err => logger.error(`[Cache] Failed to cache ${key}: ${err.message}`));

        return value;
    }

    /**
     * Invalidate cache entry
     */
    async invalidate(key: string): Promise<void> {
        try {
            await this.redis.del(key);
            logger.debug(`[Cache] Invalidated: ${key}`);
        } catch (error: any) {
            logger.error(`[Cache] Failed to invalidate ${key}: ${error.message}`);
        }
    }

    /**
     * Invalidate by pattern (e.g., "tenant:123:*")
     */
    async invalidatePattern(pattern: string): Promise<void> {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
                logger.info(`[Cache] Invalidated ${keys.length} keys matching ${pattern}`);
            }
        } catch (error: any) {
            logger.error(`[Cache] Failed to invalidate pattern ${pattern}: ${error.message}`);
        }
    }

    /**
     * Warm cache with commonly accessed data
     */
    async warm(
        key: string,
        fetchFn: () => Promise<any>,
        ttl: number = 300
    ): Promise<void> {
        if (this.warmingInProgress.has(key)) {
            logger.debug(`[Cache] Warming already in progress: ${key}`);
            return;
        }

        this.warmingInProgress.add(key);

        try {
            const value = await fetchFn();
            await this.redis.setex(key, ttl, JSON.stringify(value));
            logger.info(`[Cache] Warmed: ${key}`);
        } catch (error: any) {
            logger.error(`[Cache] Failed to warm ${key}: ${error.message}`);
        } finally {
            this.warmingInProgress.delete(key);
        }
    }

    /**
     * Get cache metrics for monitoring
     */
    getMetrics(key?: string): CacheMetrics | Map<string, CacheMetrics> {
        if (key) {
            return this.metrics.get(key) || { hits: 0, misses: 0, errors: 0, avgFetchTime: 0 };
        }
        return this.metrics;
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.metrics.clear();
        logger.info('[Cache] Metrics reset');
    }

    // Metrics tracking
    private recordHit(key: string, fetchTime: number): void {
        const metrics = this.getOrCreateMetrics(key);
        metrics.hits++;
        this.updateAvgTime(metrics, fetchTime);
    }

    private recordMiss(key: string): void {
        const metrics = this.getOrCreateMetrics(key);
        metrics.misses++;
    }

    private recordError(key: string): void {
        const metrics = this.getOrCreateMetrics(key);
        metrics.errors++;
    }

    private getOrCreateMetrics(key: string): CacheMetrics {
        if (!this.metrics.has(key)) {
            this.metrics.set(key, { hits: 0, misses: 0, errors: 0, avgFetchTime: 0 });
        }
        return this.metrics.get(key)!;
    }

    private updateAvgTime(metrics: CacheMetrics, newTime: number): void {
        const total = metrics.hits + metrics.misses;
        metrics.avgFetchTime = ((metrics.avgFetchTime * (total - 1)) + newTime) / total;
    }
}

// Cache key builders for consistency
export const CacheKeys = {
    tenant: (tenantId: string) => `tenant:${tenantId}`,
    tenantConfig: (tenantId: string) => `tenant:${tenantId}:config`,
    aiConfig: (tenantId: string) => `tenant:${tenantId}:ai_config`,
    aiEmployee: (employeeId: string) => `ai_employee:${employeeId}`,
    instanceStatus: (instanceId: string) => `instance:${instanceId}:status`,
    quota: (tenantId: string) => `quota:${tenantId}`,
    conversation: (convId: string) => `conversation:${convId}`,
    ragContext: (tenantId: string, query: string) => {
        const hash = Buffer.from(query).toString('base64').substring(0, 16);
        return `rag:${tenantId}:${hash}`;
    }
};

// Export singleton instance
export let smartCache: SmartCache;

export async function initializeSmartCache(redis: Redis): Promise<void> {
    smartCache = new SmartCache(redis);
    logger.info('✅ Smart cache initialized');
}

export default SmartCache;
