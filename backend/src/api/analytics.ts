import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * GET /api/analytics
 * Get analytics data for the tenant
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;
        const { range = '7d' } = req.query; // 24h, 7d, 30d, 90d

        // Calculate date range
        const now = new Date();
        let startDate = new Date();

        switch (range) {
            case '24h':
                startDate.setHours(now.getHours() - 24);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                break;
            case '7d':
            default:
                startDate.setDate(now.getDate() - 7);
        }

        // Get conversations count
        const totalConversations = await prisma.conversation.count({
            where: {
                tenantId,
                startedAt: { gte: startDate }
            }
        });

        // Get messages count
        const totalMessages = await prisma.message.count({
            where: {
                tenantId,
                createdAt: { gte: startDate }
            }
        });

        // Get average response time - simplified to avoid N+1 queries
        let avgResponseTime = 0;
        try {
            // Limit to recent 50 AI messages to avoid performance issues
            const recentAiMessages = await prisma.message.findMany({
                where: {
                    tenantId,
                    sender: 'ai',
                    createdAt: { gte: startDate }
                },
                take: 50,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    createdAt: true,
                    conversationId: true
                }
            });

            if (recentAiMessages.length > 0) {
                let totalResponseTime = 0;
                let responseCount = 0;

                for (const aiMsg of recentAiMessages) {
                    // Find the customer message that this AI message is responding to
                    const customerMsg = await prisma.message.findFirst({
                        where: {
                            conversationId: aiMsg.conversationId,
                            sender: 'customer',
                            createdAt: { lt: aiMsg.createdAt }
                        },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (customerMsg) {
                        const responseTime = aiMsg.createdAt.getTime() - customerMsg.createdAt.getTime();
                        totalResponseTime += responseTime;
                        responseCount++;
                    }
                }

                avgResponseTime = responseCount > 0
                    ? (totalResponseTime / responseCount) / 60000 // Convert to minutes
                    : 0;
            }
        } catch (error) {
            logger.error(`Error calculating response time: ${error}`);
            avgResponseTime = 0;
        }

        // Get AI confidence - calculate from actual AI messages
        let aiConfidence = 0;
        try {
            const aiMessagesWithConfidence = await prisma.message.findMany({
                where: {
                    tenantId,
                    sender: 'ai',
                    aiConfidence: { not: null },
                    createdAt: { gte: startDate }
                },
                select: {
                    aiConfidence: true
                }
            });

            aiConfidence = aiMessagesWithConfidence.length > 0
                ? aiMessagesWithConfidence.reduce((sum, msg) => sum + (Number(msg.aiConfidence) || 0), 0) / aiMessagesWithConfidence.length
                : 0;
        } catch (error) {
            logger.error(`Error calculating AI confidence: ${error}`);
            aiConfidence = 0;
        }

        // Get top products from inventory inquiries 
        // TODO: Implement product mention analysis from conversations
        let topProducts: { name: string; count: number }[] = [];

        // For now, query top 5 products from inventory if available
        try {
            const products = await prisma.product.findMany({
                where: { tenantId },
                take: 5,
                orderBy: { name: 'asc' }
            });

            // Return product names with placeholder counts
            topProducts.push(...products.map((p, i) => ({
                name: p.name,
                count: 0 // TODO: Count actual mentions in conversations
            })));
        } catch (error) {
            // Product table might not exist, skip
        }

        // Get conversation trend (last 7 days)
        let conversationTrend: number[] = [];
        try {
            conversationTrend = await getConversationTrend(tenantId || '', 7);
        } catch (error) {
            logger.error(`Error getting conversation trend: ${error}`);
            conversationTrend = [];
        }

        // Get hourly activity (last 24 hours) 
        let hourlyActivity: { hour: number; count: number }[] = [];
        try {
            hourlyActivity = await getHourlyActivity(tenantId || '');
        } catch (error) {
            logger.error(`Error getting hourly activity: ${error}`);
            hourlyActivity = [];
        }

        res.json({
            success: true,
            totalConversations,
            totalMessages,
            avgResponseTime,
            aiConfidence,
            topProducts,
            conversationTrend,
            hourlyActivity
        });
    } catch (error: any) {
        logger.error(`Analytics error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

/**
 * Get conversation trend for last N days
 */
async function getConversationTrend(tenantId: string, days: number): Promise<number[]> {
    const trend: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = await prisma.conversation.count({
            where: {
                tenantId,
                startedAt: {
                    gte: date,
                    lt: nextDate
                }
            }
        });

        trend.push(count);
    }

    return trend;
}

/**
 * Get hourly activity for last 24 hours
 */
async function getHourlyActivity(tenantId: string): Promise<{ hour: number; count: number }[]> {
    const activity: { hour: number; count: number }[] = [];

    for (let hour = 0; hour < 24; hour++) {
        const startOfHour = new Date();
        startOfHour.setHours(hour, 0, 0, 0);

        const endOfHour = new Date(startOfHour);
        endOfHour.setHours(hour + 1);

        const count = await prisma.message.count({
            where: {
                tenantId,
                createdAt: {
                    gte: startOfHour,
                    lt: endOfHour
                }
            }
        });

        activity.push({ hour, count });
    }

    return activity;
}

export default router;
