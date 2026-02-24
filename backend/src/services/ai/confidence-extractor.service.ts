import logger from '../../lib/logger.js';

export interface ConfidenceResult {
    confidence: number;
    cleanResponse: string;
}

/**
 * Extract confidence score from LLM response
 * Looks for patterns like "CONFIDENCE: 85" or "Confidence: 70%"
 */
export function extractConfidence(response: string): ConfidenceResult {
    if (!response) {
        return {
            confidence: 50, // Default to medium-low
            cleanResponse: response
        };
    }

    // Try multiple patterns for flexibility
    const patterns = [
        /CONFIDENCE:\s*(\d+)/i,
        /Confidence:\s*(\d+)%?/i,
        /\[confidence:\s*(\d+)\]/i
    ];

    for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match) {
            const confidence = parseInt(match[1]);

            // Validate range
            if (confidence >= 0 && confidence <= 100) {
                // Remove confidence annotation from response
                const cleanResponse = response.replace(pattern, '').trim();

                logger.debug(`[Confidence] Extracted: ${confidence}%`);

                return {
                    confidence,
                    cleanResponse
                };
            }
        }
    }

    // No valid confidence found
    logger.warn('[Confidence] No valid confidence score found in response, defaulting to 50%');

    return {
        confidence: 50,
        cleanResponse: response
    };
}

/**
 * Calculate combined confidence from multiple factors
 * Uses LLM confidence + context quality + tool results
 */
export function calculateCombinedConfidence(params: {
    llmConfidence?: number;
    contextRelevance?: number;
    toolResultsFound?: boolean;
}): number {
    const { llmConfidence = 50, contextRelevance = 0, toolResultsFound = false } = params;

    let finalConfidence = llmConfidence;

    // Boost confidence if high-quality context was found
    if (contextRelevance > 0.8) {
        finalConfidence += 10;
    }

    // Reduce confidence if context relevance is low
    if (contextRelevance < 0.5 && contextRelevance > 0) {
        finalConfidence -= 15;
    }

    // Boost if tools successfully returned results
    if (toolResultsFound) {
        finalConfidence += 5;
    }

    // Clamp to 0-100 range
    return Math.max(0, Math.min(100, Math.round(finalConfidence)));
}
