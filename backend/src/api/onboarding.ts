import { Router, Request, Response } from 'express';
import { evolutionAPI } from '../services/whatsapp/evolution.service.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { authenticate, authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/onboarding/create-instance
 * Create Evolution API instance for new tenant
 */
router.post('/create-instance', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId!; // Always use authenticated user's ID, never trust body

        // Check if Evolution API is healthy
        try {
            await evolutionAPI.getHealth();
        } catch (error) {
            logger.error('Evolution API is not accessible');
            return res.status(503).json({
                success: false,
                error: 'WhatsApp service is currently unavailable. Please try again later.',
            });
        }

        // Create Evolution instance
        const instanceName = `salestra_${tenantId}_${Date.now()}`;
        const webhookUrl = `${process.env.BACKEND_URL || 'http://host.docker.internal:3000'}/api/webhooks-v2/whatsapp`;

        const instance = await evolutionAPI.createInstance(instanceName, webhookUrl);

        // Update tenant with instance ID
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                whatsappInstanceId: instanceName,
            },
        });

        logger.info(`Evolution instance created for tenant ${tenantId}: ${instanceName}`);

        return res.json({
            success: true,
            data: {
                instanceId: instanceName,
                instanceName,
            },
        });
    } catch (error: any) {
        logger.error(`Failed to create Evolution instance: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: 'Failed to create WhatsApp instance',
            details: error.message,
        });
    }
});

/**
 * GET /api/onboarding/qr-code/:instanceId
 * Get QR code for WhatsApp connection (PRODUCTION-GRADE)
 */
router.get('/qr-code/:instanceId', async (req: Request, res: Response) => {
    try {
        const instanceId = req.params.instanceId as string;

        if (!instanceId || instanceId === 'undefined' || instanceId === 'null') {
            return res.status(400).json({
                success: false,
                error: 'Invalid instance ID provided',
            });
        }

        logger.debug(`[Onboarding] Fetching QR code for instance: ${instanceId}`);

        // First verify the instance exists
        try {
            await evolutionAPI.getInstanceStatus(instanceId);
        } catch (error: any) {
            logger.warn(`[Onboarding] Instance ${instanceId} not found in Evolution API`);
            return res.status(404).json({
                success: false,
                error: 'WhatsApp instance not found. Please create a new instance.',
                code: 'INSTANCE_NOT_FOUND'
            });
        }

        // Get QR code
        try {
            const qrCode = await evolutionAPI.getQRCode(instanceId);

            if (!qrCode.base64 && !qrCode.code) {
                logger.warn(`[Onboarding] QR code empty for ${instanceId} - may be already connected`);
                return res.status(200).json({
                    success: false,
                    error: 'QR code not available. Your WhatsApp may already be connected.',
                    code: 'QR_NOT_AVAILABLE'
                });
            }

            return res.json({
                success: true,
                data: qrCode,
            });
        } catch (qrError: any) {
            logger.error(`[Onboarding] QR code fetch failed for ${instanceId}:`, qrError.message);

            // Check if it's because the instance is already connected
            if (qrError.message?.includes('already') || qrError.message?.includes('connected')) {
                return res.status(200).json({
                    success: false,
                    error: 'This instance is already connected to WhatsApp.',
                    code: 'ALREADY_CONNECTED'
                });
            }

            return res.status(500).json({
                success: false,
                error: 'Failed to generate QR code. Please try again in a moment.',
                code: 'QR_GENERATION_FAILED'
            });
        }
    } catch (error: any) {
        logger.error(`[Onboarding] QR code endpoint error:`, error);
        return res.status(500).json({
            success: false,
            error: 'An unexpected error occurred. Please refresh and try again.',
        });
    }
});

/**
 * GET /api/onboarding/connection-status/:instanceId
 * Check WhatsApp connection status
 */
router.get('/connection-status/:instanceId', async (req: Request, res: Response) => {
    try {
        const instanceId = req.params.instanceId as string;

        const status = await evolutionAPI.getInstanceStatus(instanceId);

        return res.json({
            success: true,
            data: {
                connected: status?.state === 'open',
                status: status?.state || 'unknown',
            },
        });
    } catch (error: any) {
        logger.error(`Failed to check connection status: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: 'Failed to check connection status',
        });
    }
});

/**
 * POST /api/onboarding/complete
 * Mark onboarding as complete
 */
router.post('/complete', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId!; // Always read from JWT, not body
        const { welcomeMessage } = req.body;

        // Update business config
        await prisma.businessConfig.updateMany({
            where: { tenantId },
            data: {
                greetingFirstTime: welcomeMessage || 'Hi! How can I help you today?',
            },
        });

        // Mark tenant as active
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                status: 'active',
                onboardingCompleted: true,
            },
        });

        logger.info(`Onboarding completed for tenant ${tenantId}`);

        return res.json({
            success: true,
            message: 'Onboarding completed successfully',
        });
    } catch (error: any) {
        logger.error(`Failed to complete onboarding: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: 'Failed to complete onboarding',
        });
    }
});


/**
 * GET /api/onboarding/progress
 * Get saved onboarding state
 */
router.get('/progress', authenticate, async (req: any, res: Response) => {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: req.user.id },
            select: {
                onboardingStep: true,
                onboardingData: true,
                onboardingCompleted: true
            }
        });

        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        return res.json({
            success: true,
            data: {
                step: tenant.onboardingStep,
                data: tenant.onboardingData,
                completed: tenant.onboardingCompleted
            }
        });
    } catch (error: any) {
        logger.error(`Failed to get progress: ${error.message}`);
        return res.status(500).json({ success: false, error: 'Failed to fetch progress' });
    }
});

/**
 * POST /api/onboarding/progress
 * Update onboarding state
 */
router.post('/progress', authenticate, async (req: any, res: Response) => {
    try {
        const { step, data, completed } = req.body;

        const updateData: any = {};
        if (step !== undefined) updateData.onboardingStep = step;
        if (data !== undefined) updateData.onboardingData = data;
        if (completed !== undefined) {
            updateData.onboardingCompleted = completed;
            if (completed === true) updateData.status = 'active';
        }

        await prisma.tenant.update({
            where: { id: req.user.id },
            data: updateData
        });

        return res.json({ success: true, message: 'Progress saved' });
    } catch (error: any) {
        logger.error(`Failed to save progress: ${error.message}`);
        return res.status(500).json({ success: false, error: 'Failed to save progress' });
    }
});

export default router;
