import openai, { OPENAI_MODEL } from '../../lib/openai.js';
import ollamaService, { OllamaMessage, OllamaChatResponse } from '../../lib/ollama.js';
import groq, { GROQ_MODEL, groq2 } from '../../lib/groq.js';
import logger from '../../lib/logger.js';
import { llmCircuitBreaker, CircuitBreakerOpenError } from '../../lib/circuit-breaker.js';

/**
 * Standardized message format
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: any[];
    tool_call_id?: string;
}

/**
 * Standardized chat parameters
 */
export interface ChatParams {
    messages: LLMMessage[];
    tools?: any[];
    temperature?: number;
    max_tokens?: number;
}

/**
 * Standardized chat response
 */
export interface ChatResponse {
    content: string | null;
    tool_calls?: any[];
    finishReason?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * LLM Provider interface
 */
export interface LLMProvider {
    name: string;
    chat(params: ChatParams): Promise<ChatResponse>;
    supportsTools(): boolean;
    healthCheck(): Promise<boolean>;
}

/**
 * OpenAI Provider Implementation
 */
class OpenAIProvider implements LLMProvider {
    name = 'openai';

    async chat(params: ChatParams): Promise<ChatResponse> {
        try {
            const response = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages: params.messages as any,
                tools: params.tools,
                temperature: params.temperature ?? 0.7,
                max_tokens: params.max_tokens ?? 500,
            });

            const message = response.choices[0].message;

            return {
                content: message.content,
                tool_calls: message.tool_calls,
                finishReason: response.choices[0].finish_reason,
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0,
                },
            };
        } catch (error) {
            logger.error(`[OpenAI Provider] Chat error: ${error}`);
            throw error;
        }
    }

    supportsTools(): boolean {
        return true;
    }

    async healthCheck(): Promise<boolean> {
        try {
            await openai.models.list();
            return true;
        } catch (error) {
            return false;
        }
    }
}

/**
 * Ollama Provider Implementation
 */
class OllamaProvider implements LLMProvider {
    name = 'ollama';
    private model: string;

    constructor(model?: string) {
        this.model = model || process.env.OLLAMA_CHAT_MODEL || 'llama3.1:8b';
    }

    async chat(params: ChatParams): Promise<ChatResponse> {
        try {
            // Convert LLMMessage to OllamaMessage (filter out tool messages)
            const ollamaMessages = params.messages
                .filter(msg => msg.role !== 'tool')
                .map(msg => ({
                    role: msg.role as 'system' | 'user' | 'assistant',
                    content: msg.content || '',
                }));

            const response = await ollamaService.chat({
                model: this.model,
                messages: ollamaMessages,
                tools: params.tools,
                temperature: params.temperature,
                max_tokens: params.max_tokens,
            });

            return {
                content: response.message.content,
                tool_calls: response.message.tool_calls?.map(tc => ({
                    id: `call_${Date.now()}`,
                    type: 'function',
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.arguments),
                    },
                })),
                finishReason: response.done ? 'stop' : 'length',
            };
        } catch (error: any) {
            // Log informative error but ensure it's propagated for fallback
            logger.error(`[Ollama Provider] Chat error: ${error.message}`);

            // If it's a connection error, it's definitely a candidate for fallback
            if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
                logger.warn(`[Ollama Provider] Connection refused - Is Ollama running?`);
            }

            throw error;
        }
    }

    supportsTools(): boolean {
        // llama3.1 and newer models support function calling
        return this.model.includes('llama3.1') || this.model.includes('llama3.2');
    }

    async healthCheck(): Promise<boolean> {
        return await ollamaService.healthCheck();
    }
}

/**
 * Groq Provider Implementation (Ultra-fast inference)
 */
class GroqProvider implements LLMProvider {
    name = 'groq';
    private model: string;

    constructor(model?: string) {
        this.model = model || GROQ_MODEL;
    }

    async chat(params: ChatParams): Promise<ChatResponse> {
        // Try primary Groq API key first
        try {
            if (!groq) {
                throw new Error('Groq API key not configured');
            }

            const response = await groq.chat.completions.create({
                model: this.model,
                messages: params.messages.filter(m => m.role !== 'tool') as any,
                tools: params.tools,
                temperature: params.temperature ?? 0.7,
                max_tokens: params.max_tokens ?? 500,
            });

            const message = response.choices[0].message;

            return {
                content: message.content,
                tool_calls: message.tool_calls,
                finishReason: response.choices[0].finish_reason,
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0,
                },
            };
        } catch (error: any) {
            // Check if it's a rate limit error (429)
            const isRateLimit = error?.status === 429 || error?.message?.includes('rate_limit');

            if (isRateLimit && groq2) {
                logger.warn('[Groq Provider] Primary key rate limited, trying secondary key...');

                try {
                    // Try secondary Groq API key
                    const response = await groq2.chat.completions.create({
                        model: this.model,
                        messages: params.messages.filter(m => m.role !== 'tool') as any,
                        tools: params.tools,
                        temperature: params.temperature ?? 0.7,
                        max_tokens: params.max_tokens ?? 500,
                    });

                    const message = response.choices[0].message;

                    return {
                        content: message.content,
                        tool_calls: message.tool_calls,
                        finishReason: response.choices[0].finish_reason,
                        usage: {
                            promptTokens: response.usage?.prompt_tokens || 0,
                            completionTokens: response.usage?.completion_tokens || 0,
                            totalTokens: response.usage?.total_tokens || 0,
                        },
                    };
                } catch (secondaryError) {
                    logger.error(`[Groq Provider] Secondary key also failed: ${secondaryError}`);
                    throw secondaryError; // This will trigger Ollama fallback
                }
            }

            logger.error(`[Groq Provider] Chat error: ${error}`);
            throw error; // This will trigger Ollama fallback
        }
    }

    supportsTools(): boolean {
        return false; // DISABLED TEMPORARILY: Fixes tool_use_failed error
    }

    async healthCheck(): Promise<boolean> {
        if (!groq) return false;
        try {
            await groq.models.list();
            return true;
        } catch (error) {
            return false;
        }
    }
}

/**
 * LLM Provider Factory
 */
export class LLMProviderFactory {
    /**
     * Create provider instance based on configuration
     */
    static create(providerName: string, config?: { model?: string }): LLMProvider {
        switch (providerName.toLowerCase()) {
            case 'groq':
                return new GroqProvider(config?.model);
            case 'openai':
                return new OpenAIProvider();
            case 'ollama':
                return new OllamaProvider(config?.model);
            default:
                logger.warn(`[LLM Factory] Unknown provider '${providerName}', defaulting to Groq`);
                return new GroqProvider();
        }
    }

    /**
     * Create provider with fallback mechanism
     */
    static async createWithFallback(
        primaryProvider: string,
        fallbackProvider: string = 'openai',
        config?: { model?: string }
    ): Promise<LLMProvider> {
        const primary = this.create(primaryProvider, config);

        // Check if primary provider is healthy
        const isHealthy = await primary.healthCheck();

        if (isHealthy) {
            logger.info(`[LLM Factory] Using primary provider: ${primaryProvider}`);
            return primary;
        }

        // Fallback to secondary provider
        logger.warn(`[LLM Factory] Primary provider '${primaryProvider}' unhealthy, falling back to '${fallbackProvider}'`);
        return this.create(fallbackProvider);
    }
}

/**
 * Provider wrapper with automatic fallback and circuit breaker
 */
export class FallbackLLMProvider implements LLMProvider {
    name = 'fallback';
    private primary: LLMProvider;
    private fallback: LLMProvider;
    private fallbackEnabled: boolean;

    constructor(primary: LLMProvider, fallback: LLMProvider, enabled: boolean = true) {
        this.primary = primary;
        this.fallback = fallback;
        this.fallbackEnabled = enabled;
    }

    async chat(params: ChatParams): Promise<ChatResponse> {
        // Use circuit breaker for all LLM calls
        const fallbackFn = this.fallbackEnabled
            ? async () => {
                logger.warn(`[Fallback Provider] Using fallback provider due to circuit breaker or primary failure`);
                return await this.fallback.chat(params);
            }
            : undefined;

        try {
            return await llmCircuitBreaker.execute(
                async () => await this.primary.chat(params),
                fallbackFn
            );
        } catch (error: any) {
            if (error instanceof CircuitBreakerOpenError) {
                logger.error(`[LLM Provider] Circuit breaker open: ${error.message}`);
                logger.error(`[LLM Provider] Stats: ${JSON.stringify(error.stats)}`);
            }

            // If circuit breaker failed and we have a fallback, try it directly
            if (this.fallbackEnabled && fallbackFn) {
                logger.warn(`[Fallback Provider] Circuit breaker bypass - using fallback directly`);
                return await fallbackFn();
            }

            throw error;
        }
    }

    supportsTools(): boolean {
        return this.primary.supportsTools();
    }

    async healthCheck(): Promise<boolean> {
        const primaryHealthy = await this.primary.healthCheck();
        if (primaryHealthy) return true;

        if (this.fallbackEnabled) {
            return await this.fallback.healthCheck();
        }

        return false;
    }

    /**
     * Get circuit breaker stats for monitoring
     */
    getCircuitBreakerStats() {
        return llmCircuitBreaker.getStats();
    }
}
