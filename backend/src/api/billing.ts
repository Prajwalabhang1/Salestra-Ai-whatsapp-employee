import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = Router();

// ─── Plan Configuration ────────────────────────────────────────────────────────
// Single source of truth for plan limits — matches the landing page copy exactly
export const PLANS = {
    starter: {
        label: 'Starter',
        priceINR: 599,         // ₹599/month
        messageLimit: 1500,
        amountPaise: 59900,    // Razorpay uses paise (1 INR = 100 paise)
    },
    professional: {
        label: 'Professional',
        priceINR: 999,         // ₹999/month
        messageLimit: 5000,
        amountPaise: 99900,
    },
    enterprise: {
        label: 'Enterprise',
        priceINR: 1499,        // ₹1,499/month
        messageLimit: -1,      // Unlimited
        amountPaise: 149900,
    },
} as const;

type PlanKey = keyof typeof PLANS;

// ─── Razorpay Client ──────────────────────────────────────────────────────────
const getRazorpay = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }

    return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

/**
 * GET /api/billing
 * Get billing and subscription information
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId!;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // Get message count for current billing period
        const currentPeriodStart = tenant.currentPeriodStart || tenant.trialStartDate || tenant.createdAt;
        const messagesUsed = await prisma.message.count({
            where: {
                conversation: { tenantId },
                direction: 'outbound',  // Only count AI-sent messages
                createdAt: { gte: currentPeriodStart }
            }
        });

        // Determine plan limits
        const planKey = (tenant.subscriptionTier || 'starter') as PlanKey;
        const plan = PLANS[planKey] || PLANS.starter;

        // Calculate period end
        const trialEndDate = tenant.trialEndDate || new Date(tenant.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        const currentPeriodEnd = tenant.currentPeriodEnd || (
            tenant.status === 'trial' ? trialEndDate :
                new Date(currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000)
        );

        const subscription = {
            plan: planKey,
            label: plan.label,
            status: ['trial', 'active'].includes(tenant.status) ? 'active' : 'inactive',
            messageLimit: plan.messageLimit,
            messagesUsed,
            priceINR: plan.priceINR,
            currentPeriodEnd: currentPeriodEnd.toISOString(),
            isTrial: tenant.status === 'trial',
            daysRemaining: Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        };

        res.json({ success: true, subscription });
    } catch (error: any) {
        logger.error(`Billing error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch billing information' });
    }
});

/**
 * POST /api/billing/create-order
 * Creates a Razorpay order for plan upgrade.
 * Frontend uses this orderId to open the Razorpay payment widget.
 */
router.post('/create-order', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId!;
        const { plan } = req.body;

        if (!plan || !PLANS[plan as PlanKey]) {
            return res.status(400).json({ error: `Invalid plan. Must be one of: ${Object.keys(PLANS).join(', ')}` });
        }

        const selectedPlan = PLANS[plan as PlanKey];
        const razorpay = getRazorpay();

        const order = await razorpay.orders.create({
            amount: selectedPlan.amountPaise,
            currency: 'INR',
            receipt: `${tenantId}_${plan}_${Date.now()}`,
            notes: {
                tenantId,
                plan,
            }
        });

        logger.info(`Razorpay order created for tenant ${tenantId}: ${order.id} (plan: ${plan})`);

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            plan: {
                key: plan,
                label: selectedPlan.label,
                priceINR: selectedPlan.priceINR,
                messageLimit: selectedPlan.messageLimit,
            },
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error: any) {
        logger.error(`Create order error: ${error.message}`);
        res.status(500).json({ error: 'Failed to create payment order' });
    }
});

/**
 * POST /api/billing/verify-payment
 * Called from frontend after Razorpay widget completes payment.
 * Verifies HMAC signature, then activates the subscription.
 */
router.post('/verify-payment', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId!;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
            return res.status(400).json({ error: 'Missing payment verification fields' });
        }

        // ✅ Verify Razorpay HMAC signature
        const keySecret = process.env.RAZORPAY_KEY_SECRET!;
        const generatedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            logger.error(`[Billing] Invalid payment signature for tenant ${tenantId}`);
            return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
        }

        // Activate subscription
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                subscriptionTier: plan,
                subscriptionStatus: 'active',
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                lastPaymentId: razorpay_payment_id,
                lastOrderId: razorpay_order_id,
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                tenantId,
                action: 'SUBSCRIPTION_UPGRADED',
                entity: 'Billing',
                details: JSON.stringify({ plan, orderId: razorpay_order_id, paymentId: razorpay_payment_id }),
            }
        });

        logger.info(`✅ Subscription activated: tenant=${tenantId}, plan=${plan}, payment=${razorpay_payment_id}`);

        res.json({
            success: true,
            message: `${PLANS[plan as PlanKey]?.label || plan} plan activated successfully!`,
            subscription: { plan, status: 'active', currentPeriodEnd: periodEnd.toISOString() }
        });
    } catch (error: any) {
        logger.error(`Payment verification error: ${error.message}`);
        res.status(500).json({ error: 'Failed to activate subscription' });
    }
});

/**
 * POST /api/billing/webhook/razorpay
 * Razorpay server-to-server webhook for async payment events.
 * MUST verify the Razorpay-Signature header before trusting the payload.
 */
router.post('/webhook/razorpay', async (req: Request, res: Response) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            logger.error('[Billing Webhook] RAZORPAY_WEBHOOK_SECRET not configured');
            return res.status(500).json({ error: 'Webhook not configured' });
        }

        const signature = req.headers['x-razorpay-signature'] as string;
        const body = JSON.stringify(req.body);

        // ✅ Verify Razorpay webhook HMAC
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(body)
            .digest('hex');

        if (signature !== expectedSignature) {
            logger.warn('[Billing Webhook] Invalid Razorpay webhook signature — rejected');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = req.body.event;
        const payment = req.body.payload?.payment?.entity;

        logger.info(`[Billing Webhook] ${event}: payment ${payment?.id}`);

        if (event === 'payment.captured' && payment) {
            const tenantId = payment.notes?.tenantId;
            const plan = payment.notes?.plan as PlanKey;

            if (tenantId && plan && PLANS[plan]) {
                const now = new Date();
                const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

                await prisma.tenant.update({
                    where: { id: tenantId },
                    data: {
                        subscriptionTier: plan,
                        subscriptionStatus: 'active',
                        status: 'active',
                        currentPeriodStart: now,
                        currentPeriodEnd: periodEnd,
                        lastPaymentId: payment.id,
                    }
                });

                logger.info(`[Billing Webhook] ✅ Subscription activated via webhook: tenant=${tenantId}, plan=${plan}`);
            }
        }

        if (event === 'payment.failed') {
            logger.warn(`[Billing Webhook] Payment failed: ${payment?.id} — tenant may need follow-up`);
        }

        res.status(200).json({ received: true });
    } catch (error: any) {
        logger.error(`Razorpay webhook error: ${error.message}`);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

export default router;
