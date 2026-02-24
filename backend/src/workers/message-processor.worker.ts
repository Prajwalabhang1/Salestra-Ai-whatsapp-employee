import { messageQueue, MessageJob } from '../services/queue/message-queue.js';
import { getTenantById } from '../services/tenant/tenant.service.js';
import { evolutionAPI } from '../services/whatsapp/evolution.service.js';
import { checkAndIncrementQuota } from '../services/billing/usage-tracker.service.js';
import { detectIntent, createOrUpdateLead } from '../services/leads/lead-detector.service.js';
import { EmployeeRouter } from '../services/task-router/router.service.js';
import { buildEnhancedPersonality } from '../services/ai-agent/personality-enhanced.service.js';
import { ResponseValidator } from '../services/governance/response-validator.service.js';
import { executeAIAgent } from '../services/ai-agent/agent.service.js';
import { hybridRetrieval, formatContextForLLM } from '../services/rag/retrieval.service.js';
import { LLMProviderFactory, FallbackLLMProvider } from '../services/ai/llm-provider.service.js';
import { AI_TOOLS, executeTool } from '../services/ai-agent/tools.js';
import { validateContextForIntent } from '../services/ai-agent/intent-validator.service.js';
import { extractConfidence } from '../services/ai/confidence-extractor.service.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { isOperationDuplicate, markOperationComplete } from '../lib/cache.js';
import { instanceValidator } from '../services/whatsapp/instance-validator.service.js';
import { InstanceNotConnectedError, LLMProviderError, MessageDeliveryError, TenantInactiveError } from '../lib/error-types.js';

// Worker restart trigger: 2026-01-22
// Initialize new services
const employeeRouter = new EmployeeRouter();
const responseValidator = new ResponseValidator();

/**
 * ENHANCED Message Processor with AI Employee Integration
 * - Role-based routing
 * - Configuration-driven personality
 * - Response validation
 * - Governance enforcement
 */
messageQueue.process(async (job) => {
    const { tenantId, conversationId, customerPhone, messageText, whatsappInstanceId } = job.data;

    logger.info(`[Worker] 📨 Processing message for tenant ${tenantId}`);

    // 🛡️ IDEMPOTENCY CHECK: Prevent duplicate AI responses on retry
    const idempotencyKey = `ai_response:${conversationId}:${Buffer.from(messageText).toString('base64').substring(0, 32)}`;
    const isDuplicate = await isOperationDuplicate(idempotencyKey);

    if (isDuplicate) {
        logger.warn(`[Worker] ⚠️ Duplicate detected, skipping AI response for ${conversationId}`);
        return { skipped: true, reason: 'duplicate_detected' };
    }

    try {
        // 1. Validate instance connection FIRST
        logger.info(`[Worker] 🔌 Validating instance connection...`);
        let instanceCheck;
        try {
            instanceCheck = await instanceValidator.validateConnection(whatsappInstanceId);
        } catch (connError: any) {
            logger.error(`[Worker] 💥 Critical error validating connection: ${connError.message}`);
            // Fail gracefully instead of crashing
            instanceCheck = {
                isConnected: false,
                state: 'error',
                reason: connError.message
            };
        }

        if (!instanceCheck.isConnected) {
            logger.error(`[Worker] ❌ Instance not connected: ${instanceCheck.reason}`);

            // Try to notify customer if possible (might fail if not connected)
            try {
                await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                    number: customerPhone,
                    text: "We're experiencing technical difficulties. Our team will reach out to you shortly. 🙏",
                });
            } catch (e) {
                logger.debug(`[Worker] Could not send error message to customer: ${instanceCheck.reason}`);
            }

            await escalateConversation(conversationId, `Instance disconnected: ${instanceCheck.reason}`);

            // Return failure but DON'T THROW - return skipped status
            return { skipped: true, reason: 'instance_disconnected', detail: instanceCheck.reason };
        }
        logger.info(`[Worker] ✅ Instance connected (state: ${instanceCheck.state})`);

        // 2. Check billing quota ATOMICALLY
        const hasQuota = await checkAndIncrementQuota(tenantId);
        if (!hasQuota) {
            logger.warn(`[Worker] ⚠️ Message limit exceeded or subscription inactive for tenant ${tenantId}`);
            await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                number: customerPhone,
                text: "Thank you for your message! We're experiencing high volume. Someone from our team will reach out to you shortly. 😊",
            });
            return { skipped: true, reason: 'quota_exceeded' };
        }

        // 3. Load tenant context and validate status
        const tenant = await getTenantById(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }

        // Check tenant status
        if (tenant.status !== 'active') {
            logger.warn(`[Worker] ⚠️ Tenant ${tenantId} is ${tenant.status}`);
            await escalateConversation(conversationId, `Tenant status: ${tenant.status}`);
            throw new TenantInactiveError(tenantId, tenant.status);
        }

        // 3. Load AI configuration
        const aiConfig = await prisma.aIConfiguration.findUnique({
            where: { tenantId }
        });

        // Check if AI is enabled
        if (!aiConfig?.isEnabled || aiConfig?.maintenanceMode) {
            logger.warn(`[Worker] 🚫 Processing halted for tenant ${tenantId}. Reason: maintenance mode or AI disabled`);

            const message = aiConfig?.maintenanceMessage ||
                "Our AI assistant is currently unavailable. A team member will assist you shortly.";

            await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                number: customerPhone,
                text: message
            });

            await escalateConversation(conversationId, 'AI assistance unavailable');
            return { skipped: true, reason: 'ai_unavailable' };
        }

        // 4. Load conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { messages: { take: 10, orderBy: { createdAt: 'desc' } } }
        });

        if (!conversation) {
            throw new Error(`Conversation not found: ${conversationId}`);
        }

        // Check if conversation is escalated
        if (conversation.status === 'escalated' || conversation.assignedTo === 'human') {
            logger.info(`[Worker] 👤 Conversation ${conversationId} is handled by human, skipping AI`);
            return { skipped: true, reason: 'human_takeover' };
        }

        // 5. Detect intent and create/update lead
        const intent = detectIntent(messageText);
        if (intent) {
            await createOrUpdateLead({
                tenantId,
                conversationId,
                customerPhone,
                customerName: conversation.customerName || undefined,
                intent,
            });
        }

        // 6. Route to appropriate AI employee
        logger.info(`[Worker] 🔀 Routing message to AI employee...`);
        const aiEmployee = await employeeRouter.routeConversation(
            messageText,
            tenantId,
            conversationId
        );
        logger.info(`[Worker] 👤 Assigned to: ${aiEmployee.roleName} (${aiEmployee.roleType})`);

        // 7. Show typing indicator (human-like behavior)
        await evolutionAPI.setTyping(whatsappInstanceId, customerPhone, true);

        // 8. Build enhanced personality with AI configuration
        const personality = await buildEnhancedPersonality(tenant, aiEmployee, conversation);
        logger.info(`[Worker] 🎭 Personality: temp=${personality.temperature}, maxTokens=${personality.maxTokens}`);

        // 9. CUSTOM PROMPT MODE vs RAG MODE
        let formattedContext = '';
        let context: any = null;
        let queryIntent: string | null = null;

        if (aiConfig?.useCustomPrompt && aiConfig?.customPromptText) {
            // 🎨 CUSTOM PROMPT MODE - User provides their own context/instructions
            logger.info('[Worker] 📝 Using custom prompt mode (bypassing RAG)');
            formattedContext = aiConfig.customPromptText;
        } else {
            // 🔍 RAG MODE - Retrieve context from knowledge base
            logger.info('[Worker] 📚 Using RAG mode (retrieving context)');

            context = await hybridRetrieval({
                tenantId,
                query: messageText,
                includeInventory: tenant.businessConfig?.inventoryEnabled || false
            });
            formattedContext = formatContextForLLM(context);
            logger.info(`[Worker] 📚 Retrieved context: ${context.totalResults} results`);

            // 🛡️ RAG-ONLY ENFORCEMENT: Validate context sufficiency
            queryIntent = detectIntent(messageText);
            logger.info(`[Worker] 🎯 Detected intent: ${queryIntent || 'general'}`);

            // Check 1: No context at all
            if (context.totalResults === 0) {
                logger.warn(`[Worker] ⚠️ No context found for query: "${messageText}"`);

                await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                    number: customerPhone,
                    text: "I don't have that specific information right now. Let me connect you with someone who can help! 👋"
                });

                await escalateConversation(conversationId, 'No RAG context available');
                return { skipped: true, reason: 'no_context', intent: queryIntent };
            }

            // Check 2: Context doesn't match query intent
            const intentValidation = validateContextForIntent(queryIntent, context);
            if (!intentValidation.valid) {
                logger.warn(`[Worker] ⚠️ Context mismatch: ${intentValidation.reason}`);

                await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                    number: customerPhone,
                    text: "Let me get you the most accurate information. Connecting you with our team!"
                });

                await escalateConversation(conversationId, intentValidation.reason || 'Context intent mismatch');
                return { skipped: true, reason: 'context_intent_mismatch', details: intentValidation.reason };
            }
        }

        // 10. Build conversation history
        const history = conversation.messages
            .reverse()
            .slice(0, 5)
            .map(msg => ({
                role: msg.sender === 'customer' ? 'user' as const : 'assistant' as const,
                content: msg.messageText
            }));

        // 11. Build messages for LLM with enhanced prompt + confidence request
        const messages: any[] = [
            { role: 'system', content: personality.systemPrompt },
            { role: 'system', content: `RETRIEVED CONTEXT:\n${formattedContext}` },
            { role: 'system', content: 'IMPORTANT: At the end of your response, add a new line with: CONFIDENCE: [0-100] based on how certain you are that your answer is accurate.' },
            ...history,
            { role: 'user', content: messageText }
        ];

        // 12. Get LLM provider with fallback
        const providerName = tenant.businessConfig?.llmProvider || process.env.DEFAULT_LLM_PROVIDER || 'groq';
        const fallbackProvider = process.env.FALLBACK_LLM_PROVIDER || 'ollama';
        const enableFallback = process.env.ENABLE_LLM_FALLBACK === 'true';

        logger.info(`[Worker] 🤖 LLM Provider Selection:`);
        logger.info(`[Worker]    businessConfig.llmProvider: ${tenant.businessConfig?.llmProvider || 'null'}`);
        logger.info(`[Worker]    DEFAULT_LLM_PROVIDER: ${process.env.DEFAULT_LLM_PROVIDER}`);
        logger.info(`[Worker]    Selected: ${providerName}`);

        let provider;
        if (enableFallback) {
            const primary = LLMProviderFactory.create(providerName, { model: tenant.businessConfig?.llmModel });
            const fallback = LLMProviderFactory.create(fallbackProvider);
            provider = new FallbackLLMProvider(primary, fallback, true);
            logger.info(`[Worker] 🚀 Using ${providerName} with ${fallbackProvider} fallback`);
        } else {
            provider = LLMProviderFactory.create(providerName, { model: tenant.businessConfig?.llmModel });
            logger.info(`[Worker] 🚀 Using ${providerName} (no fallback)`);
        }

        // 13. Filter tools based on AI employee permissions
        const allowedTools = AI_TOOLS.filter(tool =>
            (aiEmployee.allowedTools as string[])?.includes(tool.function.name)
        );
        logger.info(`[Worker] 🔧 Available tools: ${allowedTools.map(t => t.function.name).join(', ')}`);

        // 14. Call LLM with enhanced personality settings
        const llmResponse = await provider.chat({
            messages,
            tools: provider.supportsTools() ? allowedTools : undefined,
            temperature: personality.temperature,
            max_tokens: personality.maxTokens
        });

        let finalResponse = llmResponse.content;

        // 🛡️ CONFIDENCE-BASED ESCALATION: Extract and validate confidence
        const confidenceResult = extractConfidence(llmResponse.content || '');
        const confidence = confidenceResult.confidence;
        finalResponse = confidenceResult.cleanResponse;

        logger.info(`[Worker] 📊 AI Confidence: ${confidence}%`);

        // Check confidence threshold
        const MIN_CONFIDENCE_THRESHOLD = aiConfig?.minConfidenceThreshold || 70;
        if (confidence < MIN_CONFIDENCE_THRESHOLD) {
            logger.warn(`[Worker] ⚠️ Low confidence (${confidence}% < ${MIN_CONFIDENCE_THRESHOLD}%) - escalating`);

            await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                number: customerPhone,
                text: "Let me get you the most accurate information from our team. I'll have someone reach out shortly! 🙏"
            });

            // Save the draft response for human review
            await prisma.message.create({
                data: {
                    conversationId,
                    tenantId,
                    direction: 'outbound',
                    sender: 'ai',
                    messageText: `[DRAFT - Not Sent] ${finalResponse}`,
                    deliveryStatus: 'failed',
                    metadata: {
                        aiEmployeeId: aiEmployee.id,
                        confidence,
                        escalationReason: 'low_confidence',
                        draftResponse: true
                    }
                }
            });

            await escalateConversation(conversationId, `Low AI confidence: ${confidence}%`);
            return { status: 'escalated', reason: 'low_confidence', confidence };
        }

        // 15. Handle tool calls if any
        if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
            logger.info(`[Worker] 🔨 Processing ${llmResponse.tool_calls.length} tool calls`);

            for (const toolCall of llmResponse.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);

                const toolResult = await executeTool(toolName, toolArgs, tenantId, conversationId);

                // Add tool results to messages and get final response
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

            // Get final response with tool results
            const followUpResponse = await provider.chat({
                messages,
                temperature: personality.temperature,
                max_tokens: personality.maxTokens
            });

            finalResponse = followUpResponse.content;
        }

        const responseText = finalResponse || "I'm sorry, I couldn't generate a response.";

        // 16. Validate response with governance checks
        logger.info(`[Worker] ✅ Validating response...`);
        const validation = await responseValidator.validateResponse(
            responseText,
            aiConfig,
            aiEmployee as any,
            tenantId,
            conversationId
        );

        if (!validation.isValid) {
            logger.warn(`[Worker] ⚠️ Validation failed: ${validation.issues.join(', ')}`);
        }

        // 17. Check if approval required
        if (validation.requiresApproval) {
            logger.warn(`[Worker] 🚨 Response requires approval: ${validation.issues.join(', ')}`);

            // Send holding message
            await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                number: customerPhone,
                text: "Let me verify this with my manager. I'll get back to you shortly."
            });

            // Escalate for approval
            await escalateConversation(conversationId, `Approval required: ${validation.issues[0]}`);

            return { status: 'pending_approval', issues: validation.issues };
        }

        // 18. Save AI response to database
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
                    roleName: aiEmployee.roleName,
                    roleType: aiEmployee.roleType,
                    validation: {
                        isValid: validation.isValid,
                        confidence: validation.confidence,
                        issues: validation.issues
                    },
                    personality: {
                        temperature: personality.temperature,
                        maxTokens: personality.maxTokens
                    }
                }
            }
        });

        // Update conversation last message time
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: new Date() }
        });

        // 19. Stop typing
        await evolutionAPI.setTyping(whatsappInstanceId, customerPhone, false);

        // REMOVED: Typing delay for faster response
        // const delay = Math.min(Math.max(responseText.length * 30, 1000), 4000);
        // await new Promise(resolve => setTimeout(resolve, delay));

        // 20. Update message status to 'sending'
        await prisma.message.update({
            where: { id: aiMessage.id },
            data: {
                deliveryStatus: 'sending',
                metadata: {
                    ...(aiMessage.metadata as any),
                    sendingAt: new Date().toISOString()
                }
            }
        });

        // 21. Send AI response to customer
        try {
            const sendResult = await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                number: customerPhone,
                text: responseText
            });

            const evolutionMessageId = sendResult?.key?.id || null;

            // Update message with delivery confirmation
            await prisma.message.update({
                where: { id: aiMessage.id },
                data: {
                    deliveryStatus: 'sent',
                    metadata: {
                        ...(aiMessage.metadata as any),
                        evolutionMessageId,
                        sentAt: new Date().toISOString()
                    }
                }
            });

            logger.info(`[Worker] ✅ Message delivered to ${customerPhone} (ID: ${evolutionMessageId})`);
        } catch (error: any) {
            logger.error(`[Worker] ❌ Failed to send message: ${error.message}`);

            // Update message with failure status
            await prisma.message.update({
                where: { id: aiMessage.id },
                data: {
                    deliveryStatus: 'failed',
                    metadata: {
                        ...(aiMessage.metadata as any),
                        sendError: error.message,
                        failedAt: new Date().toISOString()
                    }
                }
            });

            // Escalate conversation due to delivery failure
            await escalateConversation(conversationId, `Message delivery failed: ${error.message}`);
            throw error;
        }

        // 21. Check auto-end condition
        if (aiConfig.autoEndAfter) {
            const messageCount = conversation.messages.length + 1;
            if (messageCount >= aiConfig.autoEndAfter) {
                logger.info(`[Worker] 🔚 Auto-ending conversation after ${messageCount} messages`);
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { status: 'closed', closedAt: new Date() }
                });

                await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                    number: customerPhone,
                    text: "Thank you for chatting with us! If you need further assistance, feel free to message again."
                });
            }
        }

        // 22. Track billing usage - ALREADY DONE AT START
        // await trackMessageUsage(tenantId);

        logger.info(`[Worker] ✅ Message processing complete`);

        // Mark operation as complete for idempotency
        await markOperationComplete(idempotencyKey, { responseText, aiEmployee: aiEmployee.roleName });

        return {
            processed: true,
            response: responseText,
            employee: aiEmployee.roleName,
            validation: validation.isValid
        };

    } catch (error: any) {
        logger.error(`[Worker] 💥 Error processing message: ${error.message}`);
        logger.error(error.stack);

        // Classify error type for better handling
        const errorType = error.name || 'UnknownError';
        logger.error(`[Worker] Error Type: ${errorType}`);

        // ASYNC: Log error for debugging
        logger.error(`[Worker] 💥 Error processing message: ${error.message}\n${error.stack}`);

        // Handle different error types
        if (error instanceof InstanceNotConnectedError) {
            logger.error(`[Worker] ❌ Instance ${error.instanceId} not connected (${error.state})`);
            // Don't retry - requires manual intervention
            return { failed: true, reason: 'instance_not_connected', retry: false };
        }

        if (error instanceof TenantInactiveError) {
            logger.error(`[Worker] ❌ Tenant ${error.tenantId} inactive (${error.status})`);
            // Don't retry - tenant needs activation
            return { failed: true, reason: 'tenant_inactive', retry: false };
        }

        if (error.name === 'OllamaError') {
            logger.error('[Worker] ❌ LLM Provider (Ollama) failed');
            // This should have fallen back to Groq if configured
            // If we're here, both providers failed
        }

        if (error.response?.status === 400 || error.response?.status === 404) {
            logger.error(`[Worker] ❌ Evolution API error (${error.response.status})`);
            await escalateConversation(conversationId, `API error: ${error.response.status}`);
            // Don't retry 400/404 errors - likely configuration issue
            return { failed: true, reason: 'evolution_api_error', retry: false };
        }

        // Send friendly error message to customer (only for retryable errors)
        try {
            await evolutionAPI.sendTextMessage(whatsappInstanceId, {
                number: customerPhone,
                text: "Thanks for reaching out! Let me connect you with our team for personalized assistance. 👋"
            }).catch(() => { });

            // Escalate conversation on error
            await escalateConversation(conversationId, `Worker error: ${errorType}`);
        } catch (sendError) {
            logger.error(`[Worker] Failed to send error message: ${sendError}`);
        }

        // Re-throw to allow Bull retry mechanism (for retryable errors)
        throw error;
    }
});

/**
 * Helper: Escalate conversation to human
 */
async function escalateConversation(conversationId: string, reason: string) {
    await prisma.conversation.update({
        where: { id: conversationId },
        data: {
            status: 'escalated',
            assignedTo: 'human',
            escalationReason: reason
        }
    });
    logger.info(`[Worker] 🚨 Escalated conversation ${conversationId}: ${reason}`);
}
