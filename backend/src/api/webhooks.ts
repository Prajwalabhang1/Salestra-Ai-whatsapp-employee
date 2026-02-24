import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
// import { resolveTenantByWhatsApp } from '../services/tenant/tenant.service';
import { priorityMessageQueue } from '../services/queue/priority-message-queue.js';
import { verifyWebhookSignature } from '../lib/webhook-crypto.js';
import { validateWebhookPayload, sanitizeMessageText, sanitizePhoneNumber, getClientIp } from '../lib/validate.js';
import { sseService } from '../services/events/sse.service.js';
import { trackWebhookReceived } from './webhook-health.js';
import { redis } from '../lib/redis.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = Router();

// 🛡️ PRODUCTION SECURITY: Rate limiting for webhooks
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 2000, // INCREASED: Handle bursts/spam from Evolution API
    message: {
        error: 'Too many webhook requests',
        retryAfter: '60 seconds'
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    // Custom key generator - use secure IP extraction
    keyGenerator: (req) => {
        // Use instance + IP for better rate limiting granularity
        const clientIp = getClientIp(req);
        const instance = req.body?.instance || 'no-instance';
        return `${instance}:${clientIp}`;
    },
    handler: (req, res) => {
        logger.warn(`🚨 Rate limit exceeded for ${req.ip}, instance: ${req.body?.instance}`);
        res.status(429).json({
            error: 'Too many requests',
            retryAfter: 60
        });
    }
});

/**
 * WhatsApp webhook endpoint
 * Receives messages from Evolution API
 */
router.post('/whatsapp', webhookLimiter, async (req: Request, res: Response) => {
    try {
        // DEBUG: Capture raw webhook V1
        try {
            const fs = await import('fs');
            await fs.promises.appendFile('webhook-payloads-v1.log', `\n[${new Date().toISOString()}] BODY: ${JSON.stringify(req.body)}\n`);
        } catch { }

        // 🛡️ SECURITY: Validate and sanitize payload first
        const validation = validateWebhookPayload(req.body);
        if (!validation.isValid) {
            logger.warn(`🚫 Invalid webhook payload: ${validation.error}`);
            return res.status(400).json({ error: validation.error });
        }

        // Comprehensive webhook logging (using sanitized data)
        const clientIp = getClientIp(req);
        logger.info('🔔 ========== WEBHOOK RECEIVED ==========');
        logger.info(`📦 Event: ${validation.sanitizedData?.event}`);
        logger.info(`🏢 Instance: ${validation.sanitizedData?.instance}`);
        logger.info(`📱 Remote: ${req.body?.data?.key?.remoteJid}`);
        logger.info(`🌐 Client IP: ${clientIp}`);
        logger.debug(`💬 Body (truncated): ${JSON.stringify(req.body).substring(0, 200)}`);

        // 🔒 PRODUCTION SECURITY: Webhook signature verification
        const signature = req.headers['x-evolution-signature'] as string;
        const webhookSecret = process.env.WEBHOOK_SECRET;
        const isProduction = process.env.NODE_ENV === 'production';

        // In production, WEBHOOK_SECRET is REQUIRED
        if (isProduction && !webhookSecret) {
            logger.error('🚨 CRITICAL: WEBHOOK_SECRET not configured in production!');
            return res.status(500).json({
                error: 'Server misconfiguration - webhooks disabled'
            });
        }

        // Verify signature if secret is configured
        if (webhookSecret) {
            if (!signature) {
                logger.error('🚫 Missing webhook signature');
                return res.status(401).json({ error: 'Missing signature' });
            }

            const isValid = verifyWebhookSignature(req.body, signature, webhookSecret);

            if (!isValid) {
                logger.error('🚫 Invalid webhook signature - REJECTING REQUEST');
                logger.error(`Remote IP: ${req.ip}, Instance: ${req.body?.instance}`);
                return res.status(401).json({ error: 'Invalid signature' });
            }

            logger.info('✅ Webhook signature verified');
        } else if (!isProduction) {
            // Only in development: allow without signature but warn
            logger.warn('⚠️ Development mode: No signature verification (NOT SAFE FOR PRODUCTION)');
        }

        const { event, instance, data, sender } = req.body;

        // 🔧 FIX: Evolution API sends 'sender' at top level, but our logic looks in 'data'
        // Inject it into data so downstream logic can find it (crucial for LID resolution)
        if (data && sender) {
            data.sender = sender;
        }

        // Track webhook for health monitoring
        if (instance) {
            trackWebhookReceived(instance);
        }

        logger.debug(`Webhook received: ${event} from instance ${instance}`);

        // Handle different event types
        if (event === 'messages.upsert') {
            await handleIncomingMessage(instance, data);
        } else if (event === 'connection.update') {
            await handleConnectionUpdate(instance, data);
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        logger.error(`Webhook error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Handle incoming WhatsApp messages
 */
async function handleIncomingMessage(instanceId: string, data: any) {
    try {
        const message = data.key?.fromMe ? null : data.message;

        if (!message || (!message.conversation && !message.extendedTextMessage)) {
            logger.debug('Ignoring non-text message or outgoing message');
            return;
        }

        // 🔒 REDIS LOCK: Atomic Idempotency Check (Production Grade)
        // 🔒 REDIS LOCK 1: ID-Based Deduplication (Exact Match)
        // Prevents processing the same message ID twice across all workers
        const whatsappMessageId = data.key.id;
        const lockKey = `processed:msg:${whatsappMessageId}`;

        // setnx: Set if Not Exists. Returns 1 if set (new), 0 if exists (duplicate).
        // @ts-ignore
        const isNew = await redis.setnx(lockKey, '1');

        if (!isNew) {
            logger.warn(`🛑 Duplicate message rejected by Redis Lock: ${whatsappMessageId}`);
            return;
        }
        await redis.expire(lockKey, 86400);

        // Content Lock moved to after phone sanitization

        // 🛡️ SECURITY & IDENTITY: Sanitize phone number
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
        const customerPhone = sanitizePhoneNumber(cleanPhone);

        if (!customerPhone) {
            logger.warn(`Invalid phone number format: ${rawPhone.substring(0, 5)}...`);
            return;
        }

        // 🔧 HOTFIX: Map WhatsApp LID to Real Phone Number (Fallback)
        const lidMap: Record<string, string> = {
            '154288126992470': '918010076459',
            '233375705129128': '918010411281'
        };

        if (lidMap[customerPhone]) {
            logger.info(`🔄 Remapped LID ${customerPhone} to ${lidMap[customerPhone]}`);
            // We must update the 'customerPhone' variable to the real number
            // However, we can't reassign const, so we rely on the DB lookup using the remapped value.
            // Actually, we must change how we use it below.
            // Let's perform the swap here.
        }
        const finalCustomerPhone = lidMap[customerPhone] || customerPhone;

        const rawMessageText = message.conversation || message.extendedTextMessage?.text || '';
        const messageText = sanitizeMessageText(rawMessageText);

        if (!messageText) {
            logger.debug('Empty message after sanitization, ignoring');
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


        // Resolve tenant by WhatsApp instance
        const tenant = await prisma.tenant.findFirst({
            where: { whatsappInstanceId: instanceId },
        });

        if (!tenant) {
            logger.warn(`No tenant found for instance: ${instanceId}`);
            return;
        }

        // 🔒 DEDUPLICATION: Check if message already exists
        // const whatsappMessageId = data.key.id; // defined above
        const existingMessage = await prisma.message.findFirst({
            where: {
                metadata: {
                    path: ['whatsappMessageId'],
                    equals: whatsappMessageId
                }
            }
        });

        if (existingMessage) {
            logger.info(`⏭️  Duplicate message detected (${whatsappMessageId}), skipping processing`);
            return;
        }

        // 💾 DATABASE TRANSACTION: Ensure atomic operation
        const result = await prisma.$transaction(async (tx) => {
            // Find or create conversation
            let conversation = await tx.conversation.findFirst({
                where: {
                    tenantId: tenant.id,
                    customerPhone: finalCustomerPhone,
                    status: { in: ['active', 'escalated'] },
                },
                orderBy: { startedAt: 'desc' },
            });

            if (!conversation) {
                logger.info(`🆕 Creating NEW conversation for ${finalCustomerPhone}`);
                conversation = await tx.conversation.create({
                    data: {
                        tenantId: tenant.id,
                        customerPhone: finalCustomerPhone,
                        customerName: data.pushName || null,
                        status: 'active',
                        assignedTo: 'ai',
                    },
                });
                logger.info(`✅ Created conversation: ${conversation.id}`);
            } else {
                logger.info(`📝 Using existing conversation: ${conversation.id}`);
            }

            // Save incoming message
            const savedMessage = await tx.message.create({
                data: {
                    conversationId: conversation.id,
                    tenantId: tenant.id,
                    direction: 'inbound',
                    sender: 'customer',
                    messageText,
                    metadata: {
                        whatsappMessageId: data.key.id,
                        timestamp: data.messageTimestamp,
                    },
                },
            });
            logger.info(`💾 Saved message: ${savedMessage.id}`);

            // Update conversation timestamp
            await tx.conversation.update({
                where: { id: conversation.id },
                data: { lastMessageAt: new Date() },
            });
            logger.info(`🕐 Updated lastMessageAt for conversation: ${conversation.id}`);

            return { conversation, savedMessage };
        });

        const { conversation, savedMessage } = result;

        // 📡 INSTANT SSE BROADCAST: Notify connected clients
        sseService.broadcastNewMessage(tenant.id, {
            id: conversation.id,
            customerName: conversation.customerName,
            customerPhone: conversation.customerPhone,
            lastMessage: messageText.substring(0, 100),
            timestamp: new Date().toISOString()
        });
        logger.info(`📢 SSE broadcast sent for new message in conversation: ${conversation.id}`);

        // Queue for AI processing (USING PRIORITY QUEUE)
        logger.info(`Inside handleIncomingMessage: About to queue message for tenant ${tenant.id}`);
        try {
            await priorityMessageQueue.queueMessage({
                tenantId: tenant.id,
                conversationId: conversation.id,
                customerPhone: finalCustomerPhone,
                messageText,
                whatsappInstanceId: instanceId,
                whatsappMessageId: data.key.id, // 🔒 DEDUPLICATION: Pass ID
                isFirstMessage: false, // Default
                conversationLength: 0, // Default
            });
            logger.info(`Inside handleIncomingMessage: Message queued successfully to Priority Queue`);
        } catch (queueError: any) {
            logger.error(`Inside handleIncomingMessage: Queue error: ${queueError}`);
            logger.error(queueError.stack);
            throw queueError;
        }

        logger.info(`✅ Message queued successfully! ConvId: ${conversation.id}`);
        logger.info('========================================');

    } catch (error: any) {
        logger.error(`Error handling incoming message: ${error}`);
        if (error.stack) logger.error(error.stack);
        throw error;
    }
}


/**
 * Handle connection status updates from WhatsApp
 * CRITICAL: Configure webhook when connection is established
 */
async function handleConnectionUpdate(instanceId: string, data: any) {
    try {
        logger.info('🔌 ========== CONNECTION UPDATE ==========');
        logger.info(`Instance: ${instanceId}`);
        logger.info(`State: ${data.state || JSON.stringify(data)}`);

        // When WhatsApp connects (user scans QR code)
        if (data.state === 'open' || data.statusReason === 200) {
            logger.info(`✅ WhatsApp CONNECTED for instance: ${instanceId}`);

            // 🚨 CRITICAL: Configure webhook NOW that connection is established
            // ⚠️  DISABLED: V2 webhook handler takes precedence
            // This prevents Evolution API from registering BOTH /api/webhooks AND /api/webhooks-v2
            // which causes duplicate message processing
            /*
            const webhookUrl = `${process.env.BACKEND_URL || 'http://host.docker.internal:3000'}/api/webhooks/whatsapp`;

            logger.info(`📡 Configuring webhook for ${instanceId}: ${webhookUrl}`);

            try {
                const { evolutionAPI } = await import('../services/whatsapp/evolution.service.js');

                // Set webhook URL and enable MESSAGES_UPSERT
                await evolutionAPI.setWebhook(instanceId, webhookUrl);

                logger.info(`✅ Webhook configured successfully for ${instanceId}`);
                logger.info(`✅ MESSAGES_UPSERT enabled`);
                logger.info(`✅ Messages will now be received!`);

            } catch (webhookError: any) {
                logger.error(`❌ Failed to configure webhook: ${webhookError.message}`);
                logger.error(`⚠️  Manual configuration required via Evolution Manager UI`);
            }
            */
            logger.info(`ℹ️  Webhook registration handled by V2 endpoint (/api/webhooks-v2)`);
        } else if (data.state === 'close') {
            logger.warn(`⚠️  WhatsApp DISCONNECTED for instance: ${instanceId}`);
        }

        logger.info('========================================');
    } catch (error) {
        logger.error(`Error handling connection update: ${error}`);
    }
}

export default router;
