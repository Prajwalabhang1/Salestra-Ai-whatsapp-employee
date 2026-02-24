import { redis } from './redis.js';
import logger from './logger.js';
import prisma from './prisma.js';

/**
 * LID Resolver — Dynamic WhatsApp LID → Phone Number Resolution
 *
 * WhatsApp uses "LIDs" (ephemeral identifiers) in some group/business contexts
 * instead of real phone numbers. We need to map them back to real phones.
 *
 * Storage strategy:
 *   - Primary:  Redis hash `lid_map:{instanceId}` (fast, per-tenant)
 *   - Fallback: PostgreSQL `tenant_lid_map` table (persistent across restarts)
 *
 * Populated by: `connection.update` events from Evolution API (see webhooks-v2.ts)
 */

const LID_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Resolves a WhatsApp LID to the real phone number.
 * Returns null if the LID is not yet mapped.
 */
export async function resolveLIDToPhone(
    lid: string,
    instanceId: string
): Promise<string | null> {
    const redisKey = `lid_map:${instanceId}`;

    try {
        // 1. Fast path: Redis cache
        const cached = await redis.hget(redisKey, lid);
        if (cached) {
            logger.debug(`[LID] Cache hit: ${lid} → ${cached}`);
            return cached;
        }

        // 2. Slow path: DB lookup
        const mapping = await prisma.tenantLidMap.findUnique({
            where: { instanceId_lid: { instanceId, lid } }
        });

        if (mapping) {
            // Repopulate cache
            await redis.hset(redisKey, lid, mapping.phone);
            await redis.expire(redisKey, LID_TTL_SECONDS);
            logger.debug(`[LID] DB hit: ${lid} → ${mapping.phone}`);
            return mapping.phone;
        }

        logger.warn(`[LID] Unknown LID ${lid} for instance ${instanceId}`);
        return null;

    } catch (error: any) {
        logger.error(`[LID] Resolution error for ${lid}: ${error.message}`);
        return null;
    }
}

/**
 * Stores a LID → phone mapping when discovered.
 * Called from connection.update or messages.update events.
 */
export async function storeLIDMapping(
    lid: string,
    phone: string,
    instanceId: string
): Promise<void> {
    try {
        const redisKey = `lid_map:${instanceId}`;

        // Store in Redis
        await redis.hset(redisKey, lid, phone);
        await redis.expire(redisKey, LID_TTL_SECONDS);

        // Upsert in DB for persistence
        await prisma.tenantLidMap.upsert({
            where: { instanceId_lid: { instanceId, lid } },
            create: { instanceId, lid, phone },
            update: { phone }
        });

        logger.info(`[LID] Stored mapping: ${lid} → ${phone} (instance: ${instanceId})`);
    } catch (error: any) {
        logger.error(`[LID] Failed to store mapping: ${error.message}`);
    }
}
