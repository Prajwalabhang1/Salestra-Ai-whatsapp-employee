import { RetrievalContext } from '../rag/retrieval.service.js';
import logger from '../../lib/logger.js';

export interface IntentValidation {
    valid: boolean;
    reason?: string;
}

/**
 * Validate that retrieved context is sufficient for the query intent
 * This prevents the AI from responding to product queries without inventory data
 */
export function validateContextForIntent(
    intent: string | null,
    context: RetrievalContext
): IntentValidation {
    // General queries can proceed with any context
    if (!intent || intent === 'general' || intent === 'information') {
        return { valid: true };
    }

    switch (intent) {
        case 'availability':
        case 'purchase':
            // Product-related queries REQUIRE inventory data
            if (context.inventoryResults.length === 0) {
                return {
                    valid: false,
                    reason: 'Product inquiry requires inventory data (none found)'
                };
            }
            break;

        case 'pricing':
            // Pricing queries need either inventory or knowledge base data
            if (context.inventoryResults.length === 0 && context.knowledgeResults.length === 0) {
                return {
                    valid: false,
                    reason: 'Pricing inquiry requires product or pricing data (none found)'
                };
            }
            break;

        default:
            // For other intents, accept any context
            return { valid: true };
    }

    return { valid: true };
}

/**
 * Log context validation results for debugging
 */
export function logContextValidation(
    intent: string | null,
    context: RetrievalContext,
    validation: IntentValidation
): void {
    logger.debug(`[Intent Validator] Intent: ${intent || 'none'}, Context: ${context.totalResults} results, Valid: ${validation.valid}`);

    if (!validation.valid) {
        logger.warn(`[Intent Validator] ❌ ${validation.reason}`);
    }
}
