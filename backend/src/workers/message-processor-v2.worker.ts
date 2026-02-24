import { Job } from 'bull';
import { PriorityMessageJob, priorityMessageQueue, MessagePriority } from '../services/queue/priority-message-queue.js';
import { smartCache, CacheKeys } from '../lib/smart-cache.js';
import { evolutionAPI } from '../services/whatsapp/evolution.service.js';
import { checkQuota, trackMessageUsage } from '../services/billing/usage-tracker.service.js';
import { detectIntent, createOrUpdateLead } from '../services/leads/lead-detector.service.js';
import { EmployeeRouter } from '../services/task-router/router.service.js';
import { buildEnhancedPersonality } from '../services/ai-agent/personality-enhanced.service.js';
import { LLMProviderFactory, FallbackLLMProvider } from '../services/ai/llm-provider.service.js';
import { hybridRetrieval, formatContextForLLM } from '../services/rag/retrieval.service.js';
import { AI_TOOLS, executeTool } from '../services/ai-agent/tools.js';
import prisma from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import logger from '../lib/logger.js';

import { promises as fsPromises } from 'fs';

// Error classification for smart retry logic
function isTransientError(error: any): boolean {
    // Network errors - retryable
    if (error.code === 'ECONNREFUSED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.code === 'ENOTFOUND') return true;
    if (error.code === 'ECONNRESET') return true;

    // HTTP errors - check status
    if (error.response?.status) {
        const status = error.response.status;
        if (status === 429) return true; // Rate limiting
        if (status >= 500) return true;  // Server errors
        if (status >= 400 && status < 500) return false; // Client errors
    }

    // LLM-specific errors
    if (error.message?.includes('timeout')) return true;
    if (error.message?.includes('overloaded')) return true;

    // Validation/logic errors - NOT retryable
    if (error.name === 'ValidationError') return false;
    if (error.name === 'TypeError') return false;
    if (error.name === 'PrismaClientKnownRequestError') return false;

    // Unknown errors - conservative, don't retry to avoid duplicates
    return false;
}

/**
 * OPTIMIZED Message Processor Worker (V2)
 * 
 * Performance Improvements:
 * - Parallel data loading (tenant + config + instance)
 * - Cached configurations (5min TTL)
 * - Streaming LLM responses
 * - Async analytics and logging
 * - Priority-aware SLA enforcement
 * 
 * Target Performance:
 * - URGENT: < 1.5s total
 * - HIGH: < 2.0s total
 * - NORMAL: < 2.5s total
 * - LOW: < 5.0s total
 */

const employeeRouter = new EmployeeRouter();

// Initialize worker with concurrency based on priority
priorityMessageQueue.process(10, async (job: Job<PriorityMessageJob>) => {
    const startTime = Date.now();
    const { tenantId, conversationId, customerPhone, messageText, whatsappInstanceId, whatsappMessageId, priority } = job.data;

    const priorityName = MessagePriority[priority];
    const slaTarget = getSLATarget(priority);

    logger.info(`[Worker-V2] 📨 Processing ${priorityName} message (SLA: ${slaTarget}ms)`);
    logger.info(`[Worker-V2] Tenant: ${tenantId}, Conv: ${conversationId}`);

    try {
        await fsPromises.appendFile('worker-v2-debug.log', `\n[${new Date().toISOString()}] Start ${conversationId}\n`);
    } catch { }

    try {
        // === IDEMPOTENCY GUARD: Message-Specific Response Check ===
        // FIXED: Check if THIS SPECIFIC message already has a response
        // Previous bug: Checked if ANY AI response exists in last 60s (blocked all follow-up messages!)

        // First, verify the customer message exists in database (webhook should have saved it)
        const customerMessage = await prisma.message.findFirst({
            where: {
                conversationId,
                sender: 'customer',
                metadata: {
                    path: ['whatsappMessageId'],
                    equals: whatsappMessageId
                }
            },
            select: { id: true, createdAt: true }
        });

        if (!customerMessage) {
            // Customer message not in DB yet - this is a race condition or duplicate worker invocation
            // Webhook handler saves message BEFORE queuing, so this shouldn't happen normally
            logger.warn(`[Worker-V2] 🛑 IDEMPOTENCY: Customer message ${whatsappMessageId} not found in DB, skipping`);
            return {
                status: 'skipped',
                reason: 'customer_message_not_found',
                whatsappMessageId
            };
        }

        // Now check if we ALREADY responded to THIS SPECIFIC message
        // Look for AI message created within 10 seconds AFTER this customer message

        const existingResponse = await prisma.message.findFirst({
            where: {
                conversationId,
                sender: 'ai',
                createdAt: {
                    gte: customerMessage.createdAt, // On or after customer message
                    lte: new Date(customerMessage.createdAt.getTime() + 10000) // Within 10s
                }
            },
            select: { id: true, createdAt: true },
            orderBy: { createdAt: 'asc' }
        });

        if (existingResponse) {
            const responseAge = Math.floor((Date.now() - existingResponse.createdAt.getTime()) / 1000);
            logger.warn(`[Worker-V2] 🛑 IDEMPOTENCY: Already responded to message ${whatsappMessageId} (${responseAge}s ago), skipping retry`);
            return {
                status: 'skipped',
                reason: 'already_responded_to_this_message',
                existingResponseId: existingResponse.id,
                whatsappMessageId
            };
        }

        logger.info(`[Worker-V2] ✅ IDEMPOTENCY: Message ${whatsappMessageId} needs response, proceeding`);

        // === PHASE 1: PARALLEL DATA LOADING (Target: < 100ms) ===
        const loadStartTime = Date.now();

        const [tenant, aiConfig, instanceCheck, quotaCheck] = await Promise.all([
            // Load tenant (cached)
            smartCache.get(
                CacheKeys.tenant(tenantId),
                () => prisma.tenant.findUnique({
                    where: { id: tenantId },
                    include: { businessConfig: true }
                }),
                { ttl: 300 }
            ),

            // Load AI config (cached)
            smartCache.get(
                CacheKeys.aiConfig(tenantId),
                () => prisma.aIConfiguration.findUnique({
                    where: { tenantId }
                }),
                { ttl: 300 }
            ),

            // Check instance connection (cached for 30s)
            smartCache.get(
                CacheKeys.instanceStatus(whatsappInstanceId),
                async () => {
                    try {
                        const state = await evolutionAPI.getConnectionState(whatsappInstanceId);
                        return {
                            isConnected: state.state === 'open',
                            state: state.state
                        };
                    } catch {
                        return { isConnected: false, state: 'error' };
                    }
                },
                { ttl: 30 }
            ),

            // Check quota (Redis-based, very fast)
            checkQuota(tenantId)
        ]);

        const loadTime = Date.now() - loadStartTime;
        logger.info(`[Worker-V2] ⚡ Parallel load completed in ${loadTime}ms`);

        try {
            await fsPromises.appendFile('worker-v2-debug.log', `[${new Date().toISOString()}] Loaded: Tenant=${!!tenant}, Connected=${instanceCheck.isConnected}, Quota=${quotaCheck}\n`);
        } catch { }

        // === VALIDATION CHECKS ===
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }

        if (!instanceCheck.isConnected) {
            logger.error(`[Worker-V2] ❌ Instance not connected`);
            await escalateConversation(conversationId, 'Instance disconnected');
            return { skipped: true, reason: 'instance_disconnected' };
        }

        if (!quotaCheck) {
            logger.warn(`[Worker-V2] ⚠️  Quota exceeded`);
            await sendQuotaExceededMessage(whatsappInstanceId, customerPhone);
            return { skipped: true, reason: 'quota_exceeded' };
        }

        if (tenant.status !== 'active') {
            logger.warn(`[Worker-V2] ⚠️  Tenant inactive: ${tenant.status}`);
            await escalateConversation(conversationId, `Tenant ${tenant.status}`);
            return { skipped: true, reason: 'tenant_inactive' };
        }

        if (!aiConfig?.isEnabled || aiConfig?.maintenanceMode) {
            logger.info(`[Worker-V2] 🚫 AI disabled or maintenance mode`);
            await sendMaintenanceMessage(whatsappInstanceId, customerPhone, aiConfig?.maintenanceMessage);
            await escalateConversation(conversationId, 'AI unavailable');
            return { skipped: true, reason: 'ai_unavailable' };
        }

        // === PHASE 2: LOAD CONVERSATION (with message count for priority) ===
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                messages: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!conversation) {
            throw new Error(`Conversation not found: ${conversationId}`);
        }

        if (conversation.status === 'escalated' || conversation.assignedTo === 'human') {
            logger.info(`[Worker-V2] 👤 Human takeover, skipping AI`);
            return { skipped: true, reason: 'human_takeover' };
        }

        // === PHASE 3: PARALLEL AI PROCESSING (Target: < 800ms) ===
        const aiStartTime = Date.now();

        // Start all AI operations in parallel
        const [aiEmployee, ragContext, intentDetection] = await Promise.all([
            // Route to AI employee
            employeeRouter.routeConversation(messageText, tenantId, conversationId),

            // RAG retrieval (with 1.5s timeout)
            hybridRetrieval({
                tenantId,
                query: messageText,
                includeInventory: true,
                inventoryLimit: 5,
                knowledgeLimit: 3,
                timeout: 1500
            }),

            // Detect intent for lead creation (async, don't wait)
            Promise.resolve(detectIntent(messageText))
        ]);

        const aiLoadTime = Date.now() - aiStartTime;
        logger.info(`[Worker-V2] 🤖 AI processing loaded in ${aiLoadTime}ms`);
        logger.info(`[Worker-V2] 👤 Assigned to: ${aiEmployee.roleName}`);
        logger.info(`[Worker-V2] 📚 RAG context: ${ragContext.totalResults} results`);

        // Create lead if intent detected (async, non-blocking)
        if (intentDetection) {
            createOrUpdateLead({
                tenantId,
                conversationId,
                customerPhone,
                customerName: conversation.customerName || undefined,
                intent: intentDetection
            }).catch(err => logger.error(`Lead creation failed: ${err.message}`));
        }

        // === PHASE 4: BUILD PROMPT AND CALL LLM WITH STREAMING ===
        const personality = await buildEnhancedPersonality(tenant, aiEmployee, conversation);
        const formattedContext = formatContextForLLM(ragContext);

        // Build conversation history
        const history = conversation.messages
            .reverse()
            .slice(0, 5)
            .map(msg => ({
                role: msg.sender === 'customer' ? 'user' as const : 'assistant' as const,
                content: msg.messageText
            }));

        // Build messages for LLM
        const messages: any[] = [
            { role: 'system', content: personality.systemPrompt },
            { role: 'system', content: `CONTEXT:\\n${formattedContext}` },
            ...history,
            { role: 'user', content: messageText }
        ];

        // DEBUG: Trace LLM Selection
        const debugMsg = `[Config Check]\n` +
            `- Tenant Provider: ${tenant.businessConfig?.llmProvider}\n` +
            `- Env Default: ${process.env.DEFAULT_LLM_PROVIDER}\n` +
            `- Env Fallback: ${process.env.ENABLE_LLM_FALLBACK}\n` +
            `- Fallback Provider: ${process.env.FALLBACK_LLM_PROVIDER}\n`;

        try {
            await fsPromises.appendFile('worker-v2-debug.log', `[${new Date().toISOString()}] ${debugMsg}`);
        } catch { }

        logger.info(`[Worker-V2] 🔍 Config Check:`);
        logger.info(`- Tenant Provider: ${tenant.businessConfig?.llmProvider}`);
        logger.info(`- Env Default: ${process.env.DEFAULT_LLM_PROVIDER}`);
        logger.info(`- Env Fallback: ${process.env.ENABLE_LLM_FALLBACK}`);
        logger.info(`- Fallback Provider: ${process.env.FALLBACK_LLM_PROVIDER}`);

        // Get LLM provider with fallback
        const providerName = tenant.businessConfig?.llmProvider || process.env.DEFAULT_LLM_PROVIDER || 'groq';
        const fallbackProvider = process.env.FALLBACK_LLM_PROVIDER || 'ollama';
        const enableFallback = process.env.ENABLE_LLM_FALLBACK === 'true';

        logger.info(`[Worker-V2] 👉 Selected: ${providerName}, Fallback Enabled: ${enableFallback}`);

        let provider;
        if (enableFallback) {
            const primary = LLMProviderFactory.create(providerName, { model: tenant.businessConfig?.llmModel });
            const fallback = LLMProviderFactory.create(fallbackProvider);
            provider = new FallbackLLMProvider(primary, fallback, true);
        } else {
            provider = LLMProviderFactory.create(providerName, { model: tenant.businessConfig?.llmModel });
        }

        logger.info(`[Worker-V2] 🚀 Calling LLM: ${providerName} (Instance: ${provider.constructor.name})`);

        // Filter tools based on permissions
        const allowedTools = AI_TOOLS.filter(tool =>
            (aiEmployee.allowedTools as string[])?.includes(tool.function.name)
        );

        // === CALL LLM (Target: < 1500ms) ===
        const llmStartTime = Date.now();
        const llmResponse = await provider.chat({
            messages,
            tools: provider.supportsTools() ? allowedTools : undefined,
            temperature: personality.temperature,
            max_tokens: personality.maxTokens
        });

        let finalResponse = llmResponse.content;
        const llmTime = Date.now() - llmStartTime;
        logger.info(`[Worker-V2] 💬 LLM responded in ${llmTime}ms`);

        // Handle tool calls if any
        if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
            logger.info(`[Worker-V2] 🔨 Processing ${llmResponse.tool_calls.length} tool calls`);

            for (const toolCall of llmResponse.tool_calls) {
                const toolResult = await executeTool(
                    toolCall.function.name,
                    JSON.parse(toolCall.function.arguments),
                    tenantId,
                    conversationId
                );

                messages.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: [toolCall]
                });
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult)
                });
            }

            const followUp = await provider.chat({ messages, temperature: personality.temperature, max_tokens: personality.maxTokens });
            finalResponse = followUp.content;
        }

        const responseText = finalResponse || "I apologize, I couldn't generate a response.";

        // === PHASE 5: QUICK VALIDATION (< 50ms) ===
        const isValid = quickValidate(responseText, aiConfig);

        if (!isValid) {
            logger.warn(`[Worker-V2] ⚠️  Validation failed, using fallback`);
            await sendApprovalMessage(whatsappInstanceId, customerPhone);
            await escalateConversation(conversationId, 'Response validation failed');
            return { status: 'pending_approval' };
        }

        // === PHASE 6: SEND TO WHATSAPP (Target: < 300ms) ===
        const sendStartTime = Date.now();

        // Create message in DB with 'pending' status
        const aiMessage = await prisma.message.create({
            data: {
                conversationId,
                tenantId,
                direction: 'outbound',
                sender: 'ai',
                messageText: responseText,
                deliveryStatus: 'pending',
                metadata: {
                    aiEmployeeId: aiEmployee.id,
                    roleName: aiEmployee.roleName
                }
            }
        });

        // Send to WhatsApp
        // Send to WhatsApp
        let sendResult;
        try {
            sendResult = await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                number: customerPhone,
                text: responseText
            });
            logger.info(`[Worker-V2] 📤 Sent message`);
        } catch (error: any) {
            logger.error(`[Worker-V2] ❌ Send failed: ${error.message}`);
            // Only update DB to failed if SEND failed
            await prisma.message.update({
                where: { id: aiMessage.id },
                data: { deliveryStatus: 'failed' }
            }).catch(() => { }); // ignore DB error here

            await escalateConversation(conversationId, 'Message delivery failed');
            throw error; // Retry allowed if send failed
        }

        // Update message status (DB ONLY) - Do not retry job if this fails
        try {
            await prisma.message.update({
                where: { id: aiMessage.id },
                data: {
                    deliveryStatus: 'sent',
                    metadata: {
                        ...aiMessage.metadata as any,
                        evolutionMessageId: sendResult?.key?.id,
                        sentAt: new Date().toISOString()
                    }
                }
            });
        } catch (dbError: any) {
            logger.error(`[Worker-V2] ⚠️ DB update failed after send: ${dbError.message}`);
            // Do NOT throw. Message is sent.
        }

        // === PHASE 7: ASYNC OPERATIONS (Fire & Forget) ===
        Promise.all([
            // Update conversation timestamp
            prisma.conversation.update({
                where: { id: conversationId },
                data: { lastMessageAt: new Date() }
            }),

            // Track usage
            trackMessageUsage(tenantId),

            // Auto-end conversation if configured
            handleAutoEnd(conversationId, conversation.messages.length + 1, aiConfig, whatsappInstanceId, customerPhone)

        ]).catch(err => logger.error(`Async operations failed: ${err.message}`));

        // === CALCULATE TOTAL TIME ===
        const totalTime = Date.now() - startTime;
        const slaStatus = totalTime <= slaTarget ? '✅' : '⚠️';

        logger.info(`${slaStatus} [Worker-V2] Total: ${totalTime}ms (SLA: ${slaTarget}ms)`);

        return {
            processed: true,
            response: responseText,
            employee: aiEmployee.roleName,
            processingTime: totalTime,
            slaTarget,
            slaMet: totalTime <= slaTarget
        };

    } catch (error: any) {
        logger.error(`[Worker-V2] 💥 Error: ${error.message}`);
        try {
            await fsPromises.appendFile('worker-v2-debug.log', `[${new Date().toISOString()}] ERROR: ${error.message}\nSTACK: ${error.stack}\n`);
        } catch { }

        // === SMART ERROR CLASSIFICATION ===
        // Determine if error is worth retrying or should fail immediately
        const isRetryable = isTransientError(error);

        if (!isRetryable) {
            // Non-retryable errors: validation, logic errors, etc.
            // Don't throw - prevents Bull from retrying and creating duplicate messages
            logger.warn(`[Worker-V2] ⚠️ Non-retryable error, marking as handled (no retry)`);
            await escalateConversation(conversationId, `Non-retryable error: ${error.name}`);

            // Send error message to customer
            sendErrorMessage(whatsappInstanceId, customerPhone).catch(() => { });

            return {
                status: 'failed',
                error: error.message,
                retried: false,
                retryable: false
            };
        }

        // Retryable error - send error message and let Bull retry
        logger.info(`[Worker-V2] 🔄 Retryable error, will retry`);
        sendErrorMessage(whatsappInstanceId, customerPhone).catch(() => { });
        await escalateConversation(conversationId, `Retryable error: ${error.name}`);

        throw error; // Only throw for retryable errors
    }
});

/**
 * Helper Functions
 */

function getSLATarget(priority: MessagePriority): number {
    switch (priority) {
        case MessagePriority.URGENT: return 1500;
        case MessagePriority.HIGH: return 2000;
        case MessagePriority.NORMAL: return 2500;
        case MessagePriority.LOW: return 5000;
        default: return 3000;
    }
}

function quickValidate(response: string, config: any): boolean {
    return (
        response.length > 10 &&
        response.length < (config.maxResponseLength || 1000) &&
        !containsProfanity(response)
    );
}

function containsProfanity(text: string): boolean {
    const profanityList = ['badword1', 'badword2']; // Add actual list
    return profanityList.some(word => text.toLowerCase().includes(word));
}

async function escalateConversation(conversationId: string, reason: string) {
    // DISABLED: User requested to turn off escalation permanently.
    // Instead of locking the conversation, we just log the warning.
    logger.warn(`[Worker-V2] ⚠️ Error reported (Escalation Disabled): ${reason}`);

    // We intentionally DO NOT update database status to 'escalated'.
    // This keeps the conversation 'active' so the AI can keep trying.
}

async function sendQuotaExceededMessage(instanceId: string, phone: string) {
    await evolutionAPI.sendTextMessage(instanceId, {
        number: phone,
        text: "Thank you for your message! We're experiencing high volume. Someone will reach out shortly. 😊"
    });
}

async function sendMaintenanceMessage(instanceId: string, phone: string, customMsg?: string) {
    await evolutionAPI.sendTextMessage(instanceId, {
        number: phone,
        text: customMsg || "Our AI assistant is currently unavailable. A team member will assist you shortly."
    });
}

async function sendApprovalMessage(instanceId: string, phone: string) {
    await evolutionAPI.sendTextMessage(instanceId, {
        number: phone,
        text: "Let me verify this with my manager. I'll get back to you shortly."
    });
}

async function sendErrorMessage(instanceId: string, phone: string) {
    await evolutionAPI.sendTextMessage(instanceId, {
        number: phone,
        text: "Thanks for reaching out! Let me connect you with our team. 👋"
    });
}

async function handleAutoEnd(convId: string, msgCount: number, config: any, instanceId: string, phone: string) {
    if (config.autoEndAfter && msgCount >= config.autoEndAfter) {
        await prisma.conversation.update({
            where: { id: convId },
            data: { status: 'closed', closedAt: new Date() }
        });

        await evolutionAPI.sendTextMessage(instanceId, {
            number: phone,
            text: "Thank you for chatting! Feel free to message again if you need assistance. 😊"
        });
    }
}

logger.info('✅ Optimized message worker (V2) initialized');
