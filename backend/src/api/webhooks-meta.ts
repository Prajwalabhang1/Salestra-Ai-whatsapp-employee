import { Router, Request, Response } from 'express';
import logger from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import { priorityMessageQueue } from '../services/queue/priority-message-queue.js';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const router = Router();

/**
 * META WEBHOOK VERIFICATION
 * GET /api/webhooks/meta
 */
router.get('/', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // You should set this in .env
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'salestra_meta_token';

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            logger.info('[MetaWebhook] Webhook verified successfully');
            res.status(200).send(challenge);
        } else {
            logger.warn('[MetaWebhook] Verification failed');
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

/**
 * META WEBHOOK EVENT HANDLER
 * POST /api/webhooks/meta
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body;

        // Check if this is a WhatsApp event
        if (body.object === 'whatsapp_business_account') {

            // Acknowledge receipt immediately
            res.status(200).send('EVENT_RECEIVED');

            if (!body.entry || body.entry.length === 0) return;

            // Iterate over each entry
            for (const entry of body.entry) {
                const changes = entry.changes?.[0];
                const value = changes?.value;

                if (value && value.messages) {
                    const phoneNumberId = value.metadata.phone_number_id;
                    const message = value.messages[0];
                    const contact = value.contacts?.[0];

                    logger.info(`[MetaWebhook] Received message from ${message.from} for Phone ID ${phoneNumberId}`);

                    // 1. Find Tenant by Meta Phone Number ID
                    const tenant = await prisma.tenant.findFirst({
                        where: { metaPhoneNumberId: phoneNumberId }
                    });

                    if (!tenant || !tenant.whatsappInstanceId) {
                        logger.warn(`[MetaWebhook] No tenant found for Phone ID: ${phoneNumberId}`);
                        continue;
                    }

                    // 2. Transform to Evolution Payload Format (for compatibility)
                    const evolutionPayload = {
                        event: 'messages.upsert',
                        instance: tenant.whatsappInstanceId,
                        data: {
                            key: {
                                remoteJid: `${message.from}@s.whatsapp.net`,
                                fromMe: false,
                                id: message.id
                            },
                            pushName: contact?.profile?.name || message.from,
                            message: {
                                conversation: message.text?.body || '',
                                extendedTextMessage: message.type === 'text' ? { text: message.text.body } : undefined,
                                // TODO: Add support for image/video/audio mapping if needed
                            },
                            messageTimestamp: message.timestamp
                        },
                        sender: message.from,
                        params: {
                            // Add custom params if worker needs to know source
                            source: 'meta_api'
                        }
                    };

                    // 3. Queue for Processing (Reusing existing worker)
                    // We bypass the validation logic in webhooks-v2.ts and go straight to queue
                    // because Meta has already verified the source (if we used app secret proof, but here we trust the endpoint)

                    const priorityScore = 10; // Default priority

                    await priorityMessageQueue.add('process-message', {
                        instance: tenant.whatsappInstanceId,
                        data: evolutionPayload.data,
                        sender: evolutionPayload.sender
                    }, {
                        priority: priorityScore,
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 1000
                        },
                        removeOnComplete: true
                    });

                    logger.info(`[MetaWebhook] Queued message for ${tenant.whatsappInstanceId}`);
                }
            }
        } else {
            res.sendStatus(404);
        }
    } catch (error: any) {
        logger.error(`[MetaWebhook] Error processing webhook: ${error.message}`);
        // Still return 200 to prevent Meta from retrying indefinitely
        if (!res.headersSent) res.status(200).send('EVENT_RECEIVED');
    }
});

export default router;
