import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/trial/status
 * Returns trial information for authenticated user
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: userId },
            select: {
                trialStartDate: true,
                trialEndDate: true,
                subscriptionStatus: true,
                paidSubscriptionTier: true,
                createdAt: true,
            }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate trial info
        const now = new Date();
        const trialEnd = tenant.trialEndDate || new Date();
        const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const isTrialActive = tenant.subscriptionStatus === 'trial' && daysRemaining > 0;
        const isExpired = tenant.subscriptionStatus === 'trial' && daysRemaining <= 0;

        res.json({
            success: true,
            trial: {
                startDate: tenant.trialStartDate,
                endDate: tenant.trialEndDate,
                daysRemaining,
                isActive: isTrialActive,
                isExpired,
                subscriptionStatus: tenant.subscriptionStatus,
                currentTier: tenant.paidSubscriptionTier,
                canUpgrade: isExpired || daysRemaining <= 3, // Show upgrade if 3 days or less
            }
        });

    } catch (error: any) {
        console.error('Trial status error:', error);
        res.status(500).json({ error: 'Failed to fetch trial status' });
    }
});

export default router;
