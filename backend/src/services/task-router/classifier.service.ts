import { LLMProviderFactory } from '../ai/llm-provider.service.js';
import logger from '../../lib/logger.js';

export type TaskType = 'sales' | 'support' | 'complaint' | 'refund' | 'general';

/**
 * Task Classification Service
 * Uses LLM to classify customer messages into task types
 */
export class TaskClassifier {
    // CHANGED: Default to 'groq' instead of 'ollama' to avoid crashes when local LLM is missing
    private llm = LLMProviderFactory.create(process.env.DEFAULT_LLM_PROVIDER || 'groq');

    /**
     * Classify a customer message - try keywords first (fast), then LLM
     */
    async classifyMessage(messageText: string): Promise<TaskType> {
        // FAST PATH: Try keyword classification first (instant, no network call)
        const keywordResult = this.classifyByKeywords(messageText);

        // If we got a strong keyword match (not 'general'), use it immediately
        if (keywordResult !== 'general') {
            logger.info(`✅ Fast classified as: ${keywordResult} (keyword match)`);
            return keywordResult;
        }

        // EMERGENCY OVERRIDE: Skip LLM classification to stabilize worker
        logger.info(`[Classifier] ⚠️ Skipping LLM, defaulting to 'general'`);
        return 'general';

        /*
        // SLOW PATH: Only use LLM for ambiguous 'general' cases
        try {
            logger.info(`[Classifier] ⏳ calling LLM...`);

            // Create a timeout promise (5 seconds)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('LLM Timeout')), 5000)
            );

            const llmPromise = this.llm.chat({
                messages: [
                    {
                        role: 'system',
                        content: `You are a task classifier for customer service messages. Classify each message into ONE category:

- sales: Customer wants to buy, inquiring about products, pricing, availability, making a purchase
- support: Customer needs help with a product/service they own, troubleshooting, technical issues
- complaint: Customer is unhappy, dissatisfied, wants to speak to manager
- refund: Explicitly requesting refund, return, or money back
- general: Greetings, general questions, unclear intent

Respond with ONLY the category name in lowercase, nothing else.`
                    },
                    {
                        role: 'user',
                        content: messageText
                    }
                ],
                temperature: 0.3,
                max_tokens: 10
            });

            // Race LLM against timeout
            const response: any = await Promise.race([llmPromise, timeoutPromise]);

            const classification = response.content?.toLowerCase().trim() as TaskType;

            // Validate classification
            const validTypes: TaskType[] = ['sales', 'support', 'complaint', 'refund', 'general'];
            if (!validTypes.includes(classification)) {
                logger.warn(`Invalid classification: ${classification}, defaulting to general`);
                return 'general';
            }

            logger.info(`✅ LLM classified as: ${classification}`);
            return classification;

        } catch (error: any) {
            logger.warn(`LLM classification failed, using 'general': ${error.message}`);
            return 'general';
        } 
        */
    }

    /**
     * Fallback: Keyword-based classification (fast, no AI needed)
     */
    classifyByKeywords(messageText: string): TaskType {
        const lower = messageText.toLowerCase();

        // Strong complaint/refund indicators
        if (/(refund|return|money back|give.*back|want.*refund)/i.test(lower)) {
            return 'refund';
        }

        if (/(complaint|disappointed|terrible|worst|awful|horrible|unacceptable|speak.*manager)/i.test(lower)) {
            return 'complaint';
        }

        // Support keywords
        if (/(help|problem|issue|broken|not working|doesn't work|error|fix|troubleshoot|won't|can't)/i.test(lower)) {
            return 'support';
        }

        // Sales keywords
        if (/(buy|purchase|price|cost|how much|available|in stock|order|want to|interested in)/i.test(lower)) {
            return 'sales';
        }

        // Default to general
        logger.info(`No strong keywords found, classified as: general`);
        return 'general';
    }
}
