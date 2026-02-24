import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/onboarding/business-context
 * Save business context during AI employee setup
 */
router.post('/business-context', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).userId; // Get from middleware
        const { businessName, businessDescription, industry, whatsappNumber } = req.body;

        // Validate required fields
        if (!businessName || !businessDescription || !industry || !whatsappNumber) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Check if WhatsApp number is already taken by another tenant
        const existingTenant = await prisma.tenant.findUnique({
            where: { whatsappNumber }
        });

        if (existingTenant && existingTenant.id !== tenantId) {
            return res.status(400).json({
                success: false,
                error: 'This WhatsApp number is already registered to another account'
            });
        }

        // Update tenant basic info
        const tenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                businessName,
                whatsappNumber,
                status: 'onboarding_in_progress',
            }
        });

        // Create or update business config separately
        await prisma.businessConfig.upsert({
            where: { tenantId },
            create: {
                tenantId,
                businessType: industry,
                industry: industry, // Add this for consistency
                customInstructions: businessDescription,
                tone: 'professional',
                language: 'mr',
            },
            update: {
                businessType: industry,
                industry: industry, // Add this for consistency
                customInstructions: businessDescription,
            }
        });

        logger.info(`Business context saved for tenant ${tenantId}`);

        res.json({
            success: true,
            tenant: {
                id: tenant.id,
                businessName: tenant.businessName,
                whatsappNumber: tenant.whatsappNumber,
            }
        });

    } catch (error: any) {
        logger.error(`Business context error: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save business context',
            details: error.message
        });
    }
});

/**
 * POST /api/onboarding-new/check-whatsapp
 * Check if WhatsApp number is available
 */
router.post('/check-whatsapp', authenticate, async (req: Request, res: Response) => {
    try {
        const { whatsappNumber } = req.body;
        const currentTenantId = (req as any).userId;

        if (!whatsappNumber) {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp number required'
            });
        }

        // Check if another tenant has this number
        const existing = await prisma.tenant.findFirst({
            where: {
                whatsappNumber,
                id: { not: currentTenantId }
            }
        });

        res.json({
            success: true,
            available: !existing,
            message: existing ? 'This WhatsApp number is already registered' : 'Number is available'
        });

    } catch (error: any) {
        logger.error(`Check WhatsApp error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to check availability'
        });
    }
});

export default router;
