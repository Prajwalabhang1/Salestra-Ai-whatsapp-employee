import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * GET /api/settings
 * Get tenant's business settings
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                businessConfig: true
            }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // Extract settings from onboardingData (using it as a flexible storage for preferences)
        const savedPrefs = (tenant.onboardingData as any)?.preferences || {};

        const settings = {
            businessName: tenant.businessName || '',
            businessDescription: tenant.businessConfig?.customInstructions || '',
            industry: tenant.businessConfig?.industry || tenant.businessConfig?.businessType || 'retail',
            phone: tenant.whatsappNumber || '',
            email: tenant.email,
            timezone: tenant.businessConfig?.timezone || 'Asia/Kolkata',
            whatsappConnected: !!tenant.whatsappInstanceId,
            tone: tenant.businessConfig?.tone || 'professional',
            language: tenant.businessConfig?.language || 'en',
            // Load saved notifications or default
            notifications: savedPrefs.notifications || {
                email: true,
                escalation: true,
                dailyReport: false,
                whatsapp_alerts: true
            },
            theme: savedPrefs.theme || 'system'
        };

        res.json({ success: true, settings });
    } catch (error: any) {
        logger.error(`Get settings error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * PUT /api/settings
 * Update tenant's business settings
 */
router.put('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;
        const { businessName, businessDescription, industry, phone, email, timezone, tone, language, notifications, theme } = req.body;

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        // Preserve existing onboarding data while updating preferences
        const existingData = (tenant.onboardingData as any) || {};
        const updatedOnboardingData = {
            ...existingData,
            preferences: {
                ...existingData.preferences,
                notifications,
                theme
            }
        };

        // Update tenant
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                businessName,
                whatsappNumber: phone,
                email,
                onboardingData: updatedOnboardingData
            }
        });

        // Update or create business config
        const existingConfig = await prisma.businessConfig.findUnique({
            where: { tenantId }
        });

        if (existingConfig) {
            await prisma.businessConfig.update({
                where: { tenantId },
                data: {
                    industry,
                    businessType: industry,
                    customInstructions: businessDescription,
                    timezone,
                    tone,
                    language
                }
            });
        } else {
            await prisma.businessConfig.create({
                data: {
                    tenantId: tenantId!,
                    industry,
                    businessType: industry,
                    customInstructions: businessDescription,
                    timezone,
                    tone,
                    language
                }
            });
        }

        // Log functionality - audit log
        await prisma.auditLog.create({
            data: {
                tenantId: tenantId!,
                action: 'UPDATE_SETTINGS',
                entity: 'Settings',
                entityId: tenantId,
                details: JSON.stringify({ businessName, timezone }) // Store simplified details
            } as any // Cast because details vs changes field mismatch in standard audit log
        });

        logger.info(`Settings updated for tenant: ${tenantId}`);
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: any) {
        logger.error(`Update settings error: ${error.message}`);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * GET /api/settings/activity
 * Get recent account activity
 */
router.get('/activity', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;
        const logs = await prisma.auditLog.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        const formattedLogs = logs.map(log => ({
            id: log.id,
            action: log.action,
            details: (log as any).details || log.changes || 'User Action',
            ip: log.ipAddress || '127.0.0.1',
            device: 'Web Client', // Placeholder as we don't track UA yet
            timestamp: log.createdAt
        }));

        res.json({ success: true, logs: formattedLogs });
    } catch (error: any) {
        logger.error(`Activity log error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

export default router;
