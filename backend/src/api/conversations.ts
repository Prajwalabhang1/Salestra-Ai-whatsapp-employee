import express from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = express.Router();
import { authenticate, AuthRequest } from '../middleware/auth.js';

/**
 * GET /api/conversations
 * List all conversations for the authenticated tenant
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const tenantId = (req as AuthRequest).userId;
        const { status, search, limit = '50', offset = '0' } = req.query;

        // Build filter conditions
        const where: any = { tenantId };

        if (status && status !== 'all') {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { customerName: { contains: search as string, mode: 'insensitive' } },
                { customerPhone: { contains: search as string } }
            ];
        }

        // Fetch conversations with recent messages and counts
        const conversations = await prisma.conversation.findMany({
            where,
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
            orderBy: {
                lastMessageAt: 'desc'
            },
            include: {
                messages: {
                    take: 100, // Fetch more messages to calculate unread accurately
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                _count: {
                    select: {
                        messages: true
                    }
                }
            }
        });

        // Get total count for pagination
        const total = await prisma.conversation.count({ where });

        // Format conversations for frontend with calculated data
        // NO MORE N+1 QUERIES - calculate everything from already-fetched data
        const formatted = conversations.map((conv) => {
            // Use _count for total messages (already fetched)
            const messageCount = conv._count.messages;

            // Calculate unread from already-fetched messages
            // Note: This assumes messages don't have a 'read' field yet
            // Count customer messages as "unread" if no AI response after them
            const unreadCount = conv.messages.filter(m => m.sender === 'customer').length;

            // Get last customer message and AI response
            const lastCustomerMsg = conv.messages.find(m => m.sender === 'customer');
            const lastAiMsg = conv.messages.find(m => m.sender === 'ai');

            return {
                id: conv.id,
                customerName: conv.customerName || conv.customerPhone,
                customerPhone: conv.customerPhone,
                lastMessage: lastCustomerMsg?.messageText || '',
                aiResponse: lastAiMsg?.messageText || 'Processing...',
                timestamp: conv.lastMessageAt
                    ? getRelativeTime(conv.lastMessageAt)
                    : getRelativeTime(conv.startedAt),
                status: conv.status,
                unreadCount: Math.min(unreadCount, 99), // Cap at 99 for display
                messageCount
            };
        });

        res.json({
            success: true,
            conversations: formatted,
            pagination: {
                total,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
                hasMore: parseInt(offset as string) + parseInt(limit as string) < total
            }
        });
    } catch (error) {
        logger.error(`Error fetching conversations: ${error}`);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
}

/**
 * GET /api/conversations/:id
 * Get full conversation details with messages and metadata
 */
router.get('/:conversationId', authenticate, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const tenantId = (req as AuthRequest).userId;

        // Fetch conversation with all messages
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                tenantId
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Calculate metadata
        const totalDuration = conversation.lastMessageAt
            ? new Date(conversation.lastMessageAt).getTime() - new Date(conversation.startedAt).getTime()
            : 0;

        const durationDays = Math.floor(totalDuration / (1000 * 60 * 60 * 24));
        const durationHours = Math.floor((totalDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        let durationText = '';
        if (durationDays > 0) {
            durationText = `${durationDays} day${durationDays > 1 ? 's' : ''}`;
        } else if (durationHours > 0) {
            durationText = `${durationHours} hour${durationHours > 1 ? 's' : ''}`;
        } else {
            const durationMins = Math.floor(totalDuration / (1000 * 60));
            durationText = `${durationMins} min`;
        }

        // Calculate AI metrics
        const aiMessages = conversation.messages.filter(m => m.sender === 'ai');
        const avgConfidence = aiMessages.length > 0
            ? aiMessages.reduce((sum, msg) => sum + (Number(msg.aiConfidence) || 0), 0) / aiMessages.length
            : 0;

        // Format messages with metadata
        const formattedMessages = conversation.messages.map(msg => ({
            id: msg.id,
            sender: msg.sender,
            messageText: msg.messageText,
            timestamp: msg.createdAt,
            relativeTime: getRelativeTime(msg.createdAt),
            aiConfidence: msg.aiConfidence ? Number(msg.aiConfidence) : null,
            metadata: msg.metadata
        }));

        res.json({
            success: true,
            conversation: {
                id: conversation.id,
                customerName: conversation.customerName || conversation.customerPhone,
                customerPhone: conversation.customerPhone,
                status: conversation.status,
                assignedTo: conversation.assignedTo,
                sentiment: conversation.sentiment,
                language: conversation.language,
                tags: conversation.tags || [],
                startedAt: conversation.startedAt,
                lastMessageAt: conversation.lastMessageAt,
                messageCount: conversation.messages.length,
                unreadCount: conversation.messages.filter(m => m.sender === 'customer').length
            },
            messages: formattedMessages,
            metadata: {
                totalDuration: durationText,
                avgConfidence: Math.round(avgConfidence * 100),
                escalationCount: 0, // TODO: Track escalations
                responseRate: aiMessages.length > 0 ? '< 1 min avg' : 'N/A'
            }
        });
    } catch (error) {
        logger.error(`Error fetching conversation detail: ${error}`);
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});


/**
 * Get conversation by ID with messages
 */
router.get('/:conversationId/messages', authenticate, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const tenantId = (req as AuthRequest).userId;

        // Validate conversation belongs to tenant
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                tenantId
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
        });

        res.json({ messages });
    } catch (error) {
        logger.error(`Error fetching messages: ${error}`);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * Takeover conversation (switch from AI to human)
 */
router.post('/:conversationId/takeover', authenticate, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const tenantId = (req as AuthRequest).userId;

        // Validate conversation belongs to tenant
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                tenantId
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                assignedTo: 'human',
                status: 'active',
            },
        });

        logger.info(`Conversation ${conversationId} taken over by human`);
        res.json({ success: true, message: 'Conversation taken over' });
    } catch (error) {
        logger.error(`Error taking over conversation: ${error}`);
        res.status(500).json({ error: 'Failed to takeover conversation' });
    }
});

/**
 * Return conversation to AI
 */
router.post('/:conversationId/return-to-ai', authenticate, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const tenantId = (req as AuthRequest).userId;

        // Validate conversation belongs to tenant
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                tenantId
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                assignedTo: 'ai',
                status: 'active',
            },
        });

        logger.info(`Conversation ${conversationId} returned to AI`);
        res.json({ success: true, message: 'Conversation returned to AI' });
    } catch (error) {
        logger.error(`Error returning conversation to AI: ${error}`);
        res.status(500).json({ error: 'Failed to return conversation to AI' });
    }
});

export default router;
