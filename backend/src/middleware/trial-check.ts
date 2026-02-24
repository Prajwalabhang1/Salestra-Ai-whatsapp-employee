import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.js';
l
/**
 * Middleware to check if user's trial has expired
 * Blocks access to protected routes if trial ended and no active subscription
 */
export const checkTrialStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: userId },
            select: {
                trialEndDate: true,
                subscriptionStatus: true,
                paidSubscriptionTier: true,
            }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Allow if user has active paid subscription
        if (tenant.subscriptionStatus === 'active') {
            return next();
        }

        // Check trial expiry
        if (tenant.subscriptionStatus === 'trial') {
            const now = new Date();
            const trialEnd = tenant.trialEndDate || new Date();

            if (now > trialEnd) {
                // Trial expired - return 402 Payment Required
                return res.status(402).json({
                    error: 'Trial expired',
                    message: 'Your 14-day free trial has ended. Please upgrade to continue using Salestra.',
                    trialExpired: true,
                    upgradeUrl: '/upgrade'
                });
            }
        }

        // Trial still active or other valid status
        next();

    } catch (error: any) {
        console.error('Trial check error:', error);
        // On error, allow request to proceed (fail open for better UX)
        next();
    }
};

export default checkTrialStatus;
