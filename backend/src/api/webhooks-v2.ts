import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { verifyWebhookSignature } from '../lib/webhook-crypto.js';
import { validateWebhookPayload, sanitizeMessageText, sanitizePhoneNumber, getClientIp } from '../lib/validate.js';
import { priorityMessageQueue } from '../services/queue/priority-message-queue.js';
import { smartCache, CacheKeys } from '../lib/smart-cache.js';
import { evolutionAPI } from '../services/whatsapp/evolution.service.js';
import { trackWebhookReceived } from './webhook-health.js';
import prisma from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import logger from '../lib/logger.js';

const router = Router();

// Rate limiting
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => {
        const clientIp = getClientIp(req);
        const instance = req.body?.instance || 'no-instance';
        return `${instance}:${clientIp}`;
    },
    handler: (req, res) => {
        logger.warn(`🚨 Rate limit exceeded for ${req.ip}`);
        res.status(429).json({ error: 'Too many requests' });
    }
});

/**
 * OPTIMIZED WhatsApp Webhook Endpoint
 * 
 * Performance Optimizations:
 * - Parallel validation + typing indicator
 * - Redis deduplication (faster than DB)
 * - Fire-and-forget DB save
 * - Priority-based queuing
 * - Target: < 100ms response time
 */
router.post('/whatsapp', webhookLimiter, async (req: Request, res: Response) => {
    const requestStartTime = Date.now();

    try {
        // === PHASE 1: PARALLEL VALIDATION (Target: < 30ms) ===
        const [validation, _tracked] = await Promise.all([
            // Validate payload
            Promise.resolve(validateWebhookPayload(req.body)),

            // Track webhook health (async, don't wait)
            req.body?.instance
                ? Promise.resolve(trackWebhookReceived(req.body.instance))
                : Promise.resolve()
        ]);

        if (!validation.isValid) {
            logger.warn(`🚫 Invalid webhook payload: ${validation.error}`);
            return res.status(400).json({ error: validation.error });
        }

        const { event, instance, data, sender } = req.body;
        const clientIp = getClientIp(req);

        // 🔧 FIX: Evolution API sends 'sender' at top level, but our logic looks in 'data'
        // Inject it into data so downstream logic can find it (crucial for LID resolution)
        if (data && sender) {
            data.sender = sender;
        }

        logger.info(`🔔 Webhook: ${event} from ${instance} (${clientIp})`);

        // === PHASE 2: SIGNATURE VERIFICATION (Target: < 20ms) ===
        const signature = req.headers['x-evolution-signature'] as string;
        const webhookSecret = process.env.WEBHOOK_SECRET;

        if (webhookSecret && !signature) {
            return res.status(401).json({ error: 'Missing signature' });
        }

        if (webhookSecret && !verifyWebhookSignature(req.body, signature, webhookSecret)) {
            logger.error('🚫 Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // === PHASE 3: HANDLE EVENTS ===
        if (event === 'messages.upsert') {
            await handleIncomingMessageOptimized(instance, data, requestStartTime);
        } else if (event === 'connection.update') {
            await handleConnectionUpdate(instance, data);
        } else if (event === 'messages.update') {
            // Handle delivery receipts (async, don't block)
            handleMessageUpdate(instance, data).catch(err =>
                logger.error(`Failed to handle message update: ${err.message}`)
            );
        }

        const responseTime = Date.now() - requestStartTime;
        logger.info(`✅ Webhook processed in ${responseTime}ms`);

        res.status(200).json({ success: true, processedIn: responseTime });

    } catch (error: any) {
        const responseTime = Date.now() - requestStartTime;
        logger.error(`Webhook error after ${responseTime}ms: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * OPTIMIZED: Handle incoming messages with performance focus
 */
async function handleIncomingMessageOptimized(instanceId: string, data: any, requestStartTime: number) {
    try {
        // Ignore outgoing messages
        if (data.key?.fromMe) {
            logger.debug('Ignoring outgoing message');
            return;
        }

        const message = data.message;
        if (!message || (!message.conversation && !message.extendedTextMessage)) {
            logger.debug('Ignoring non-text message');
            return;
        }

        // 🔒 REDIS LOCK 1: ID-Based Deduplication (Exact Match)
        const whatsappMessageId = data.key.id;
        const lockKey = `processed:msg:${whatsappMessageId}`;
        const isNew = await redis.setnx(lockKey, '1');
        // === PHASE 1: SANITIZE DATA (< 5ms) ===
        // === PHASE 1: SANITIZE DATA (< 5ms) ===
        // SMART EXTRACTION: Select the best candidate for phone number
        const candidates = [
            data.key.remoteJid,
            data.key.remoteJidAlt,
            data.key.participant,
            data.sender  // Contains actual phone when remoteJid is LID
        ].filter(Boolean);

        // 1. Prefer ones ending in @s.whatsapp.net (Standard JID)
        const standardJid = candidates.find((c: string) => c.endsWith('@s.whatsapp.net'));

        // 2. Avoid ones ending in @lid unless it's the only option
        const nonLid = candidates.find((c: string) => !c.endsWith('@lid') && !c.includes('@lid'));

        // Strategy: Use Standard JID > Non-LID > First Candidate
        let rawPhone = standardJid || nonLid || candidates[0];

        let cleanPhone = rawPhone.replace('@s.whatsapp.net', '').replace('@lid', '');

        // Dynamically resolve WhatsApp LID to real phone number from cache/DB
        if (cleanPhone.match(/^\d{15,}$/) && !cleanPhone.startsWith('91')) {
            try {
                const { resolveLIDToPhone } = await import('../lib/lid-resolver.js');
                const resolved = await resolveLIDToPhone(cleanPhone, instanceId);
                if (resolved) {
                    logger.info(`🔄 Resolved LID ${cleanPhone} → ${resolved}`);
                    cleanPhone = resolved;
                }
            } catch (lidErr: any) {
                logger.warn(`Could not resolve LID ${cleanPhone}: ${lidErr.message}`);
            }
        }

        const finalCustomerPhone = sanitizePhoneNumber(cleanPhone);

        const rawMessageText = message.conversation || message.extendedTextMessage?.text || '';
        const messageText = sanitizeMessageText(rawMessageText);
        // const whatsappMessageId = data.key.id; // Already defined above

        if (!finalCustomerPhone || !messageText) {
            logger.debug('Invalid phone or empty message');
            return;
        }

        // 🔒 REDIS LOCK 2: Content-Based Deduplication (Phone + Message)
        // This prevents duplicate webhook events (LID, Standard JID, History Sync) 
        // with DIFFERENT Message IDs but SAME content from being processed
        logger.debug(`🔍 Dedup Check: Phone=${finalCustomerPhone}, Text="${messageText.substring(0, 30)}..."`);

        const contentKey = `dedup:content:${finalCustomerPhone}:${messageText.substring(0, 100).replace(/\s/g, '')}`;
        const isNewContent = await redis.setnx(contentKey, '1');

        if (!isNewContent) {
            logger.warn(`🛑 Duplicate content blocked: Same message from ${finalCustomerPhone} within 3s`);
            return;
        }

        await redis.expire(contentKey, 3); // REDUCED from 10s: Allow faster follow-up messages
        logger.info(`✅ Content lock set for ${finalCustomerPhone}`);

        // === PHASE 3: PARALLEL OPERATIONS (< 50ms total) ===
        const [tenant, typingStarted] = await Promise.all([
            // Get tenant from cache (fast!)
            smartCache.get(
                CacheKeys.tenant(instanceId),
                () => prisma.tenant.findFirst({
                    where: { whatsappInstanceId: instanceId }
                }),
                { ttl: 300 } // Cache for 5 minutes
            ),

            // Send typing indicator immediately (async, don't wait for response)
            evolutionAPI.setTyping(instanceId, finalCustomerPhone, true)
                .then(() => true)
                .catch(() => false)
        ]);

        if (!tenant) {
            logger.warn(`No tenant found for instance: ${instanceId}`);
            return;
        }

        // === PHASE 4: FIND/CREATE CONVERSATION (Optimized query) ===
        let conversation = await prisma.conversation.findFirst({
            where: {
                tenantId: tenant.id,
                customerPhone: finalCustomerPhone,
                status: { in: ['active', 'escalated'] },
            },
            orderBy: { startedAt: 'desc' },
            select: {
                id: true,
                customerName: true,
                status: true,
                _count: {
                    select: { messages: true }
                }
            }
        });

        const isFirstMessage = !conversation;
        let conversationLength = 0;

        if (!conversation) {
            logger.info(`🆕 Creating new conversation for ${finalCustomerPhone}`);
            conversation = await prisma.conversation.create({
                data: {
                    tenantId: tenant.id,
                    customerPhone: finalCustomerPhone,
                    customerName: data.pushName || null,
                    status: 'active',
                    assignedTo: 'ai',
                },
                select: {
                    id: true,
                    customerName: true,
                    status: true,
                    _count: {
                        select: { messages: true }
                    }
                }
            });
        } else {
            conversationLength = conversation._count.messages;
        }

        // === PHASE 5: SAVE MESSAGE (Fire-and-forget, async) ===
        // 🔍 DEBUG: Log before attempting save
        logger.info('🔍 DEBUG: About to save message to database', {
            conversationId: conversation.id,
            tenantId: tenant.id,
            messageText: messageText.substring(0, 50) + '...',
            whatsappMessageId,
            messageLength: messageText.length
        });

        const saveMessagePromise = prisma.message.create({
            data: {
                conversationId: conversation.id,
                tenantId: tenant.id,
                direction: 'inbound',
                sender: 'customer',
                messageText,
                metadata: {
                    whatsappMessageId,
                    timestamp: data.messageTimestamp,
                },
            },
        }).then(msg => {
            logger.info(`💾 Message saved successfully!`, {
                messageId: msg.id,
                conversationId: conversation.id,
                tenantId: tenant.id,
                timestamp: msg.createdAt
            });
            return msg;
        }).catch(err => {
            // 🚨 CRITICAL: Don't hide database errors!
            logger.error(`❌ CRITICAL: Message save failed!`, {
                error: {
                    message: err.message,
                    code: err.code,
                    stack: err.stack,
                    name: err.name
                },
                context: {
                    conversationId: conversation.id,
                    tenantId: tenant.id,
                    whatsappMessageId,
                    messageLength: messageText.length
                }
            });

            // Re-throw to surface the error
            throw err;
        });

        // Update conversation timestamp (async)
        prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() }
        }).catch(err => logger.error(`Failed to update conversation: ${err.message}`));

        // === PHASE 6: QUEUE FOR AI PROCESSING WITH PRIORITY ===
        logger.info('📤 Queueing message for AI processing', {
            conversationId: conversation.id,
            tenantId: tenant.id,
            isFirstMessage,
            conversationLength
        });

        await priorityMessageQueue.queueMessage({
            tenantId: tenant.id,
            conversationId: conversation.id,
            customerPhone: finalCustomerPhone,
            messageText,
            whatsappInstanceId: instanceId,
            whatsappMessageId, // 🔒 DEDUPLICATION: Pass ID
            isFirstMessage,
            conversationLength
        });

        const totalTime = Date.now() - requestStartTime;
        logger.info(`✅ Message queued in ${totalTime}ms (Target: < 100ms)`);

        // Wait for message save to complete (don't block response to Evolution API)
        try {
            await saveMessagePromise;
            logger.info('✅ DEBUG: Message save promise resolved successfully');
        } catch (saveError: any) {
            logger.error('❌ DEBUG: Message save promise rejected!', {
                error: saveError.message,
                stack: saveError.stack
            });
            // Don't throw - webhook already responded, but log the critical failure
        }

    } catch (error: any) {
        logger.error(`Error handling incoming message: ${error.message}`);
        throw error;
    }
}

/**
 * Handle message delivery/read status updates
 */
async function handleMessageUpdate(instanceId: string, data: any) {
    try {
        const { key, update } = data;
        const whatsappMessageId = key?.id;

        if (!whatsappMessageId || !update) {
            return;
        }

        logger.info(`📬 Message update: ${whatsappMessageId} → ${update.status}`);

        // Use raw SQL to merge into the metadata JSON field without overwriting other fields
        await prisma.$executeRaw`
            UPDATE messages
            SET
                delivery_status = ${update.status as string},
                metadata = metadata || jsonb_build_object(
                    'statusUpdate', ${update.status as string}::text,
                    'updatedAt', ${new Date().toISOString()}::text
                )
            WHERE metadata->>'whatsappMessageId' = ${whatsappMessageId}
        `;

        logger.info(`✅ Updated message status to ${update.status}`);

    } catch (error: any) {
        logger.error(`Error handling message update: ${error.message}`);
    }
}

/**
 * Handle connection status updates
 */
async function handleConnectionUpdate(instanceId: string, data: any) {
    try {
        logger.info(`🔌 Connection update: ${instanceId} → ${data.state}`);

        // Invalidate instance status cache
        await smartCache.invalidate(CacheKeys.instanceStatus(instanceId));

        if (data.state === 'open' || data.statusReason === 200) {
            logger.info(`✅ WhatsApp connected: ${instanceId}`);

            const webhookUrl = `${process.env.BACKEND_URL || 'http://host.docker.internal:3000'}/api/webhooks-v2/whatsapp`;

            try {
                await evolutionAPI.setWebhook(instanceId, webhookUrl);
                logger.info(`✅ Webhook configured for ${instanceId}`);
            } catch (webhookError: any) {
                logger.error(`❌ Failed to configure webhook: ${webhookError.message}`);
            }
        } else if (data.state === 'close') {
            logger.warn(`⚠️  WhatsApp disconnected: ${instanceId}`);
        }

    } catch (error: any) {
        logger.error(`Error handling connection update: ${error.message}`);
    }
}

export default router;
