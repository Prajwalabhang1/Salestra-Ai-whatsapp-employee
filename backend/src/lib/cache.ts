/**
 * Caching Layer
 * Generic Redis-backed caching with TTL support
 */

import { redis } from './redis.js';
import logger from './logger.js';
import { isFeatureEnabled } from './secrets.js';

// ============================================
// CACHE CONFIGURATION
// ============================================

const CACHE_PREFIX = 'cache:';
const DEFAULT_TTL = 300; // 5 minutes

// ============================================
// CORE CACHE FUNCTIONS
// ============================================

/**
 * Generic cache wrapper - fetches from cache or executes fetcher function
 */
export async function withCache<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    options: {
        skipCache?: boolean;
        forceRefresh?: boolean;
    } = {}
): Promise<T> {
    // Check if caching is disabled globally
    if (!isFeatureEnabled('ENABLE_CACHING') || options.skipCache) {
        return fetcher();
    }

    const cacheKey = `${CACHE_PREFIX}${key}`;

    // Check cache first (unless forcing refresh)
    if (!options.forceRefresh) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                logger.debug(`[Cache] HIT: ${key}`);
                return JSON.parse(cached);
            }
            logger.debug(`[Cache] MISS: ${key}`);
        } catch (error: any) {
            logger.warn(`[Cache] Error reading cache: ${error.message}`);
            // Continue to fetcher on cache read error
        }
    }

    // Fetch fresh data
    const result = await fetcher();

    // Store in cache
    try {
        await redis.setex(cacheKey, ttlSeconds, JSON.stringify(result));
        logger.debug(`[Cache] SET: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error: any) {
        logger.warn(`[Cache] Error writing cache: ${error.message}`);
        // Return result even if caching fails
    }

    return result;
}

/**
 * Get a value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
    if (!isFeatureEnabled('ENABLE_CACHING')) {
        return null;
    }

    try {
        const cacheKey = `${CACHE_PREFIX}${key}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }
        return null;
    } catch (error: any) {
        logger.warn(`[Cache] Error getting cache: ${error.message}`);
        return null;
    }
}

/**
 * Set a value in cache
 */
export async function setCache(
    key: string,
    value: any,
    ttlSeconds: number = DEFAULT_TTL
): Promise<boolean> {
    if (!isFeatureEnabled('ENABLE_CACHING')) {
        return false;
    }

    try {
        const cacheKey = `${CACHE_PREFIX}${key}`;
        await redis.setex(cacheKey, ttlSeconds, JSON.stringify(value));
        return true;
    } catch (error: any) {
        logger.warn(`[Cache] Error setting cache: ${error.message}`);
        return false;
    }
}

/**
 * Delete a value from cache
 */
export async function deleteCache(key: string): Promise<boolean> {
    try {
        const cacheKey = `${CACHE_PREFIX}${key}`;
        await redis.del(cacheKey);
        logger.debug(`[Cache] DEL: ${key}`);
        return true;
    } catch (error: any) {
        logger.warn(`[Cache] Error deleting cache: ${error.message}`);
        return false;
    }
}

/**
 * Delete multiple cache keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
    try {
        const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
        if (keys.length === 0) return 0;

        await redis.del(...keys);
        logger.debug(`[Cache] DEL pattern ${pattern}: ${keys.length} keys`);
        return keys.length;
    } catch (error: any) {
        logger.warn(`[Cache] Error deleting pattern: ${error.message}`);
        return 0;
    }
}

/**
 * Check if a key exists in cache
 */
export async function hasCache(key: string): Promise<boolean> {
    try {
        const cacheKey = `${CACHE_PREFIX}${key}`;
        const exists = await redis.exists(cacheKey);
        return exists === 1;
    } catch (error: any) {
        return false;
    }
}

// ============================================
// IDEMPOTENCY HELPERS
// ============================================

const IDEMPOTENCY_PREFIX = 'idem:';
const IDEMPOTENCY_TTL = 3600; // 1 hour

/**
 * Check if an operation has already been performed (idempotency check)
 * Returns true if operation should be skipped (already done)
 */
export async function isOperationDuplicate(operationKey: string): Promise<boolean> {
    try {
        const key = `${IDEMPOTENCY_PREFIX}${operationKey}`;
        const exists = await redis.exists(key);
        return exists === 1;
    } catch (error: any) {
        logger.warn(`[Idempotency] Check error: ${error.message}`);
        return false; // On error, allow the operation
    }
}

/**
 * Mark an operation as completed (for idempotency)
 */
export async function markOperationComplete(
    operationKey: string,
    result?: any,
    ttlSeconds: number = IDEMPOTENCY_TTL
): Promise<boolean> {
    try {
        const key = `${IDEMPOTENCY_PREFIX}${operationKey}`;
        const value = JSON.stringify({
            completedAt: new Date().toISOString(),
            result: result || null,
        });
        await redis.setex(key, ttlSeconds, value);
        logger.debug(`[Idempotency] Marked complete: ${operationKey}`);
        return true;
    } catch (error: any) {
        logger.warn(`[Idempotency] Mark error: ${error.message}`);
        return false;
    }
}

/**
 * Get the result of a previously completed operation
 */
export async function getOperationResult(operationKey: string): Promise<any | null> {
    try {
        const key = `${IDEMPOTENCY_PREFIX}${operationKey}`;
        const data = await redis.get(key);
        if (data) {
            const parsed = JSON.parse(data);
            return parsed.result;
        }
        return null;
    } catch (error: any) {
        return null;
    }
}

/**
 * Clear an idempotency key (for retry scenarios)
 */
export async function clearOperationKey(operationKey: string): Promise<boolean> {
    try {
        const key = `${IDEMPOTENCY_PREFIX}${operationKey}`;
        await redis.del(key);
        return true;
    } catch (error: any) {
        return false;
    }
}

// ============================================
// CACHE STATISTICS
// ============================================

export async function getCacheStats(): Promise<{
    enabled: boolean;
    keyCount: number;
    idempotencyKeyCount: number;
}> {
    const enabled = isFeatureEnabled('ENABLE_CACHING');

    if (!enabled) {
        return { enabled: false, keyCount: 0, idempotencyKeyCount: 0 };
    }

    try {
        const cacheKeys = await redis.keys(`${CACHE_PREFIX}*`);
        const idempotencyKeys = await redis.keys(`${IDEMPOTENCY_PREFIX}*`);

        return {
            enabled,
            keyCount: cacheKeys.length,
            idempotencyKeyCount: idempotencyKeys.length,
        };
    } catch (error: any) {
        return { enabled, keyCount: -1, idempotencyKeyCount: -1 };
    }
}

export default {
    withCache,
    getCache,
    setCache,
    deleteCache,
    deleteCachePattern,
    hasCache,
    isOperationDuplicate,
    markOperationComplete,
    getOperationResult,
    clearOperationKey,
    getCacheStats,
};
