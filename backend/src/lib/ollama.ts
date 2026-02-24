import axios, { AxiosInstance } from 'axios';
import logger from './logger.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10);

export interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OllamaToolCall {
    name: string;
    arguments: Record<string, any>;
}

export interface OllamaChatRequest {
    model: string;
    messages: OllamaMessage[];
    tools?: any[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface OllamaChatResponse {
    message: {
        role: string;
        content: string;
        tool_calls?: OllamaToolCall[];
    };
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_duration?: number;
    eval_duration?: number;
}

export interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
}

class OllamaService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: OLLAMA_URL,
            timeout: OLLAMA_TIMEOUT_MS,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        logger.info(`[Ollama] Initialized with URL: ${OLLAMA_URL}`);
    }

    /**
     * Generate chat completion
     */
    async chat(params: OllamaChatRequest): Promise<OllamaChatResponse> {
        try {
            const startTime = Date.now();

            // Disable tools for current model to prevent hanging
            // TODO: Re-enable when model support is confirmed
            const toolsPayload = undefined;

            const response = await this.client.post('/api/chat', {
                model: params.model,
                messages: params.messages,
                tools: toolsPayload,
                options: {
                    temperature: params.temperature ?? 0.7,
                    num_predict: params.max_tokens ?? 500,
                },
                stream: false,
            });

            const duration = Date.now() - startTime;
            logger.info(`[Ollama] Chat completion in ${duration}ms`);

            return response.data;
        } catch (error: any) {
            logger.error(`[Ollama] Chat error: ${error.message}`);
            if (error.response) {
                logger.error(`[Ollama] Response status: ${error.response.status}`);
                logger.error(`[Ollama] Response data: ${JSON.stringify(error.response.data)}`);
            }
            throw new OllamaError('Chat completion failed', error);
        }
    }

    /**
     * Generate embeddings
     */
    async generateEmbedding(text: string, model?: string): Promise<number[]> {
        try {
            const embedModel = model || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text:latest';

            const response = await this.client.post('/api/embeddings', {
                model: embedModel,
                prompt: text,
            });

            return response.data.embedding;
        } catch (error: any) {
            logger.error(`[Ollama] Embedding error: ${error.message}`);
            throw new OllamaError('Embedding generation failed', error);
        }
    }

    /**
     * Pull a model from Ollama registry
     */
    async pullModel(modelName: string): Promise<void> {
        try {
            logger.info(`[Ollama] Pulling model: ${modelName}`);

            await this.client.post('/api/pull', {
                name: modelName,
                stream: false,
            });

            logger.info(`[Ollama] Model ${modelName} pulled successfully`);
        } catch (error: any) {
            logger.error(`[Ollama] Pull model error: ${error.message}`);
            throw new OllamaError(`Failed to pull model ${modelName}`, error);
        }
    }

    /**
     * List available models
     */
    async listModels(): Promise<OllamaModel[]> {
        try {
            const response = await this.client.get('/api/tags');
            return response.data.models || [];
        } catch (error: any) {
            logger.error(`[Ollama] List models error: ${error.message}`);
            throw new OllamaError('Failed to list models', error);
        }
    }

    /**
     * Delete a model
     */
    async deleteModel(modelName: string): Promise<void> {
        try {
            await this.client.delete('/api/delete', {
                data: { name: modelName },
            });
            logger.info(`[Ollama] Model ${modelName} deleted`);
        } catch (error: any) {
            logger.error(`[Ollama] Delete model error: ${error.message}`);
            throw new OllamaError(`Failed to delete model ${modelName}`, error);
        }
    }

    /**
     * Check if Ollama is healthy and reachable
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.client.get('/api/tags', {
                timeout: 5000,
            });
            return response.status === 200;
        } catch (error) {
            logger.warn('[Ollama] Health check failed');
            return false;
        }
    }

    /**
     * Check if a specific model is available
     */
    async isModelAvailable(modelName: string): Promise<boolean> {
        try {
            const models = await this.listModels();
            return models.some(m => m.name === modelName || m.name.startsWith(modelName));
        } catch (error) {
            return false;
        }
    }
}

export class OllamaError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'OllamaError';
    }
}

// Singleton instance
const ollamaService = new OllamaService();
export default ollamaService;
