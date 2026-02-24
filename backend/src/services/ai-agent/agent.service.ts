import logger from '../../lib/logger.js';
import prisma from '../../lib/prisma.js';
import { v4 as uuidv4 } from 'uuid';
import { TenantContext } from '../tenant/tenant.service.js';
import { hybridRetrieval, formatContextForLLM } from '../rag/retrieval.service.js';
import { getAIPersonality } from './personality.service.js';
import { AI_TOOLS, executeTool } from './tools.js';
import { LLMProviderFactory, LLMProvider, FallbackLLMProvider, LLMMessage } from '../ai/llm-provider.service.js';

export interface IncomingMessage {
    conversationId: string;
    customerPhone: string;
    messageText: string;
}

export interface AIResponse {
    responseText: string;
    confidence: number;
    shouldEscalate: boolean;
    escalationReason?: string;
    toolsUsed: any[];
    provider?: string;
}

/**
 * Get conversation history
 */
async function getConversationHistory(conversationId: string, limit: number = 5) {
    const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit * 2, // Get both customer and AI messages
    });

    return messages.reverse().map(msg => ({
        role: msg.sender === 'customer' ? 'user' : 'assistant',
        content: msg.messageText,
    }));
}

/**
 * Main AI agent execution
 */
export async function executeAIAgent(
    tenant: TenantContext,
    message: IncomingMessage
): Promise<AIResponse> {
    const executionId = `exec_${uuidv4()}`;
    const startTime = Date.now();

    try {
        logger.info(`[${executionId}] Starting AI agent for tenant ${tenant.id}`);

        // 1. Load personality
        const personality = getAIPersonality(tenant);

        // 2. Retrieve context (RAG)
        const context = await hybridRetrieval({
            tenantId: tenant.id,
            query: message.messageText,
            includeInventory: tenant.businessConfig?.inventoryEnabled || false,
        });

        // 2.1 STRICT VALIDATION: No context = No AI response (prevent hallucination)
        if (context.totalResults === 0) {
            logger.warn(`[${executionId}] No knowledge/inventory found for: "${message.messageText}"`);

            const noKnowledgeResponse = getNoKnowledgeResponse(tenant.businessName, tenant.businessConfig?.language || 'en');

            return {
                responseText: noKnowledgeResponse,
                confidence: 0.0,
                shouldEscalate: true,
                escalationReason: 'no_business_knowledge_or_inventory_available',
                toolsUsed: [],
                provider: 'none'
            };
        }

        const rawContext = formatContextForLLM(context);
        // Truncate context to ~12,000 chars (approx 3000 tokens) to leave room for history and new tokens
        // This is a safety measure to prevent 400 Bad Request from LLM
        const formattedContext = rawContext.length > 12000
            ? rawContext.substring(0, 12000) + "\n...[Context Truncated]"
            : rawContext;

        // 3. Get conversation history
        const history = await getConversationHistory(message.conversationId, 5);

        // 4. Build messages for LLM
        const messages: any[] = [
            { role: 'system', content: personality.systemPrompt },
            { role: 'system', content: `RETRIEVED CONTEXT:\n${formattedContext}` },
            ...history,
            { role: 'user', content: message.messageText },
        ];

        // 5. Get tools available for this tenant
        const availableTools = tenant.businessConfig?.inventoryEnabled
            ? AI_TOOLS
            : AI_TOOLS.filter(t => t.function.name !== 'search_inventory' && t.function.name !== 'get_product_details' && t.function.name !== 'check_stock');

        // 6. Get LLM provider (with fallback)
        const providerName = tenant.businessConfig?.llmProvider || process.env.DEFAULT_LLM_PROVIDER || 'ollama';
        const enableFallback = process.env.ENABLE_LLM_FALLBACK === 'true';

        let provider: LLMProvider;
        if (enableFallback && providerName === 'ollama') {
            // Create fallback provider: Ollama -> OpenAI
            const primary = LLMProviderFactory.create('ollama', {
                model: tenant.businessConfig?.llmModel || process.env.OLLAMA_CHAT_MODEL
            });
            const fallback = LLMProviderFactory.create('openai');
            provider = new FallbackLLMProvider(primary, fallback, true);
            logger.info(`[${executionId}] Using Ollama with OpenAI fallback`);
        } else {
            provider = LLMProviderFactory.create(providerName, {
                model: tenant.businessConfig?.llmModel
            });
            logger.info(`[${executionId}] Using provider: ${providerName}`);
        }

        // 7. Call LLM
        const llmResponse = await provider.chat({
            messages: messages as LLMMessage[],
            tools: provider.supportsTools() ? availableTools : undefined,
            temperature: personality.temperature,
            max_tokens: 500,
        });

        const toolsUsed: any[] = [];
        let finalResponse = {
            content: llmResponse.content,
            tool_calls: llmResponse.tool_calls,
        };

        // Limit tool iterations to prevent infinite loops
        const MAX_TOOL_ITERATIONS = 5;
        let iterationCount = 0;

        // 8. Handle tool calls
        while (finalResponse.tool_calls && finalResponse.tool_calls.length > 0) {
            iterationCount++;
            if (iterationCount > MAX_TOOL_ITERATIONS) {
                logger.warn(`[${executionId}] 🚨 Max tool iterations (${MAX_TOOL_ITERATIONS}) reached. Breaking loop.`);
                break;
            }

            logger.info(`[${executionId}] Processing ${finalResponse.tool_calls.length} tool calls (Iteration ${iterationCount})`);

            // Execute tools
            for (const toolCall of finalResponse.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);

                logger.debug(`[${executionId}] Executing tool: ${toolName} with args:`, toolArgs);

                const toolResult = await executeTool(
                    toolName,
                    toolArgs,
                    tenant.id,
                    message.conversationId
                );

                toolsUsed.push({
                    tool: toolName,
                    params: toolArgs,
                    result: toolResult,
                });

                // Add tool call and result to messages
                messages.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: [toolCall],
                });

                // Truncate large tool outputs (e.g. huge inventory lists)
                const resultStr = JSON.stringify(toolResult);
                const truncatedResult = resultStr.length > 5000
                    ? resultStr.substring(0, 5000) + "...(truncated)"
                    : resultStr;

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: truncatedResult,
                });
            }

            // Get final response with tool results
            const followUpResponse = await provider.chat({
                messages: messages as LLMMessage[],
                temperature: personality.temperature,
                max_tokens: 500,
            });

            finalResponse = {
                content: followUpResponse.content,
                tool_calls: followUpResponse.tool_calls,
            };
        }

        const responseText = finalResponse.content || "I'm sorry, I couldn't generate a response.";

        // 9. Calculate confidence (simple heuristic)
        const confidence = calculateConfidence(context, responseText);

        // 10. Determine if escalation needed
        const shouldEscalate = confidence < 0.7 || context.totalResults === 0;
        const escalationReason = shouldEscalate
            ? confidence < 0.7
                ? 'Low confidence in response'
                : 'No relevant information found'
            : undefined;

        // 11. Log execution
        const executionTime = Date.now() - startTime;
        await prisma.executionLog.create({
            data: {
                executionId,
                tenantId: tenant.id,
                conversationId: message.conversationId,
                inputMessage: message.messageText,
                retrievedContext: context as any,
                aiReasoning: finalResponse.content || '',
                aiConfidence: confidence,
                finalResponse: responseText,
                toolsUsed: toolsUsed as any,
                executionTimeMs: executionTime,
                status: shouldEscalate ? 'escalated' : 'success',
            },
        });

        logger.info(`[${executionId}] Completed in ${executionTime}ms, confidence: ${confidence.toFixed(2)}, provider: ${providerName}`);

        return {
            responseText,
            confidence,
            shouldEscalate,
            escalationReason,
            toolsUsed,
            provider: providerName,
        };

    } catch (error) {
        logger.error(`[${executionId}] Error in AI agent: ${error}`);

        // Log error
        await prisma.executionLog.create({
            data: {
                executionId,
                tenantId: tenant.id,
                conversationId: message.conversationId,
                inputMessage: message.messageText,
                status: 'failed',
                errorMessage: String(error),
                executionTimeMs: Date.now() - startTime,
            },
        });

        throw error;
    }
}

/**
 * Get appropriate "no knowledge" response based on language
 */
function getNoKnowledgeResponse(businessName: string, language: string): string {
    const responses: Record<string, string> = {
        'en': `I don't have information about that in my current knowledge base. Let me connect you with our team at ${businessName} who can help you better.`,
        'hi': `मेरे पास इसके बारे में जानकारी नहीं है। मैं आपको ${businessName} की हमारी टीम से जोड़ता हूं जो आपकी बेहतर मदद कर सकती है।`,
        'mr': `माझ्याकडे याबद्दल माहिती नाही. मी तुम्हाला ${businessName} च्या आमच्या टीमशी जोडतो जे तुम्हाला चांगले मदत करू शकतात।`
    };

    return responses[language] || responses['en'];
}

/**
 * Simple confidence calculation
 */
function calculateConfidence(context: any, response: string): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if we found context
    if (context.totalResults > 0) {
        confidence += 0.2;
    }

    // Higher confidence if we found inventory results
    if (context.inventoryResults.length > 0) {
        confidence += 0.2;
    }

    // Higher confidence if response is substantial
    if (response.length > 50) {
        confidence += 0.1;
    }

    // Check for uncertainty phrases
    const uncertaintyPhrases = ['i don\'t know', 'not sure', 'might be', 'uncertain'];
    const lowerResponse = response.toLowerCase();
    if (uncertaintyPhrases.some(phrase => lowerResponse.includes(phrase))) {
        confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
}
