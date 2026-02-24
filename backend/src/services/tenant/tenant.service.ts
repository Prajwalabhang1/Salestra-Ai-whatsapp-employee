import prisma from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import logger from '../../lib/logger.js';

const TENANT_CACHE_PREFIX = 'tenant:';
const TENANT_CACHE_TTL = 3600; // 1 hour

export interface TenantContext {
    id: string;
    businessName: string;
    whatsappNumber: string;
    whatsappInstanceId: string | null | undefined;
    subscriptionTier: string;
    status: string;
    businessConfig: {
        businessType: string;
        industry: string | null;
        tone: string;
        language: string;
        timezone: string;
        workingHours: any;
        customInstructions: string | null;
        inventoryEnabled: boolean;
        greetingFirstTime: string | null;
        greetingReturning: string | null;
        escalationRules: any;
        // LLM Configuration
        llmProvider?: string;
        llmModel?: string;
        embeddingProvider?: string;
        embeddingModel?: string;
        enableFallback?: boolean;
        maxResponseTokens?: number;
        aiTemperature?: number;
    } | null;
}

/**
 * Resolve tenant by WhatsApp number with caching
 */
export async function resolveTenantByWhatsApp(whatsappNumber: string): Promise<TenantContext | null> {
    try {
        // Check cache first
        const cacheKey = `${TENANT_CACHE_PREFIX}whatsapp:${whatsappNumber}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            logger.debug(`Tenant cache hit for WhatsApp: ${whatsappNumber}`);
            return JSON.parse(cached);
        }

        // Query database
        const tenant = await prisma.tenant.findUnique({
            where: { whatsappNumber },
            include: { businessConfig: true },
        });

        if (!tenant) {
            logger.warn(`No tenant found for WhatsApp number: ${whatsappNumber}`);
            return null;
        }

        // Check if tenant is active
        if (tenant.status !== 'active') {
            logger.warn(`Tenant ${tenant.id} is not active: ${tenant.status}`);
            return null;
        }

        // Cache the result
        await redis.setex(cacheKey, TENANT_CACHE_TTL, JSON.stringify(tenant));

        return tenant as TenantContext;
    } catch (error) {
        logger.error(`Error resolving tenant: ${error}`);
        throw error;
    }
}

/**
 * Get tenant by ID with caching
 */
export async function getTenantById(tenantId: string): Promise<TenantContext | null> {
    try {
        const cacheKey = `${TENANT_CACHE_PREFIX}id:${tenantId}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { businessConfig: true },
        });

        if (tenant) {
            await redis.setex(cacheKey, TENANT_CACHE_TTL, JSON.stringify(tenant));
        }

        return tenant as TenantContext | null;
    } catch (error) {
        logger.error(`Error getting tenant: ${error}`);
        throw error;
    }
}

/**
 * Invalidate tenant cache
 */
export async function invalidateTenantCache(tenantId: string, whatsappNumber?: string) {
    const keys = [`${TENANT_CACHE_PREFIX}id:${tenantId}`];
    if (whatsappNumber) {
        keys.push(`${TENANT_CACHE_PREFIX}whatsapp:${whatsappNumber}`);
    }
    await redis.del(...keys);
    logger.debug(`Invalidated cache for tenant: ${tenantId}`);
}

/**
 * Create new tenant
 */
export async function createTenant(data: {
    businessName: string;
    whatsappNumber: string;
    email: string;
    passwordHash: string;
    subscriptionTier?: string;
}) {
    try {
        const tenant = await prisma.tenant.create({
            data: {
                businessName: data.businessName,
                whatsappNumber: data.whatsappNumber,
                email: data.email,
                passwordHash: data.passwordHash,
                subscriptionTier: data.subscriptionTier || 'starter',
                status: 'active',
            },
        });

        logger.info(`Created new tenant: ${tenant.id}`);
        return tenant;
    } catch (error) {
        logger.error(`Error creating tenant: ${error}`);
        throw error;
    }
}

/**
 * Update business configuration
 */
export async function updateBusinessConfig(tenantId: string, config: any) {
    try {
        const updated = await prisma.businessConfig.upsert({
            where: { tenantId },
            create: {
                tenantId,
                ...config,
            },
            update: config,
        });

        // Invalidate cache
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (tenant) {
            await invalidateTenantCache(tenantId, tenant.whatsappNumber || undefined);
        }

        return updated;
    } catch (error) {
        logger.error(`Error updating business config: ${error}`);
        throw error;
    }
}
