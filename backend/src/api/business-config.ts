import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/business-config/personality
 * Save AI personality configuration
 */
router.post('/personality', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId;
        const { tone, language, customInstructions, workingHoursEnabled, workingHoursStart, workingHoursEnd } = req.body;

        // Prepare working hours data
        const workingHours = workingHoursEnabled ? JSON.stringify({
            enabled: true,
            start: workingHoursStart,
            end: workingHoursEnd
        }) : null;

        // Check if business config already exists
        const existing = await prisma.businessConfig.findUnique({
            where: { tenantId }
        });

        // Update or create business config
        const config = await prisma.businessConfig.upsert({
            where: { tenantId },
            create: {
                tenantId: tenantId!,
                businessType: existing?.businessType || 'retail', // Use existing or default
                tone: tone || 'professional',
                language: language || 'mr',
                customInstructions: customInstructions || '',
                workingHours: workingHours as any
            },
            update: {
                tone,
                language,
                customInstructions,
                workingHours: workingHours as any
            }
        });

        logger.info(`AI personality configured for tenant ${tenantId}`);

        res.json({
            success: true,
            config: {
                tone: config.tone,
                language: config.language
            }
        });
    } catch (error: any) {
        logger.error(`Personality config error: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save personality settings',
            details: error.message
        });
    }
});

/**
 * Get business configuration
 */
router.get('/', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }

        const config = await prisma.businessConfig.findUnique({
            where: { tenantId },
        });

        res.json({ config });
    } catch (error) {
        logger.error(`Error fetching business config: ${error}`);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

/**
 * Update business configuration
 */
router.put('/', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }

        const {
            businessType,
            tone,
            language,
            workingHours,
            inventoryEnabled,
            customInstructions
        } = req.body;

        const config = await prisma.businessConfig.upsert({
            where: { tenantId },
            create: {
                tenantId,
                businessType,
                tone,
                language,
                workingHours,
                inventoryEnabled,
                customInstructions,
            },
            update: {
                businessType,
                tone,
                language,
                workingHours,
                inventoryEnabled,
                customInstructions,
                updatedAt: new Date(),
            },
        });

        logger.info(`Updated business config for tenant ${tenantId}`);
        res.json({ config, message: 'Configuration updated successfully' });
    } catch (error) {
        logger.error(`Error updating business config: ${error}`);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

export default router;
