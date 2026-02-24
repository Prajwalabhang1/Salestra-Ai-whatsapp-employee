import prisma from '../../lib/prisma.js';
import logger from '../../lib/logger.js';
import { generateEmbedding } from './embedding.service.js';
import { searchVectors } from './vector-store.service.js';

export interface RetrievalContext {
    inventoryResults: any[];
    knowledgeResults: any[];
    totalResults: number;
    // 🆕 Highest relevance score from knowledge results (for confidence calculation)
    maxRelevanceScore: number;
}

/**
 * Structured inventory search with Fuzzy Matching
 */
async function searchInventory(
    tenantId: string,
    query: string,
    limit: number = 5
): Promise<any[]> {
    try {
        const keywords = query.split(/\s+/).filter(w => w.length > 2);

        // Build OR conditions for each keyword across multiple fields
        const fuzzyConditions = keywords.map(word => ({
            OR: [
                { name: { contains: word, mode: 'insensitive' } },
                { description: { contains: word, mode: 'insensitive' } }
            ]
        }));

        const items = await prisma.inventoryItem.findMany({
            where: {
                tenantId,
                status: 'active',
                // Match ANY of the keywords if exact phrase fails
                // @ts-ignore - QueryMode type mismatch
                OR: [
                    { name: { contains: query, mode: 'insensitive' } }, // Exact phrase match (Priority)
                    ...fuzzyConditions // Fuzzy keyword match
                ]
            },
            take: limit,
            orderBy: {
                stockQuantity: 'desc',
            },
        });

        // Deduplicate results by ID
        const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());

        logger.debug(`Found ${uniqueItems.length} inventory items for query: ${query}`);
        return uniqueItems;
    } catch (error) {
        logger.error(`Error searching inventory: ${error}`);
        return [];
    }
}

/**
 * Semantic search in vector DB (Knowledge Base)
 */
async function searchKnowledge(
    tenantId: string,
    query: string,
    limit: number = 5,
    threshold: number = 0.7
): Promise<any[]> {
    try {
        const embedding = await generateEmbedding(query);
        const results = await searchVectors(tenantId, embedding, limit, threshold);

        // Filter out low scores (double check)
        return results.filter(r => r.score >= threshold);
    } catch (error) {
        logger.error(`Error searching knowledge: ${error}`);
        return [];
    }
}

// ... (previous imports)

/**
 * Fallback: Search Spreadsheet Data (SQL-based)
 * Helpful when vector store is unavailable or empty
 */
async function searchSpreadsheet(
    tenantId: string,
    query: string,
    limit: number = 5
): Promise<any[]> {
    try {
        // Use PostgreSQL ILIKE for safe, indexed keyword search — no memory scanning
        const keywordPattern = `%${query.replace(/[%_]/g, '\\$&')}%`;

        const rows = await prisma.$queryRaw<any[]>`
            SELECT id, data, created_at
            FROM spreadsheet_data
            WHERE tenant_id = ${tenantId}
              AND data::text ILIKE ${keywordPattern}
            ORDER BY created_at DESC
            LIMIT ${limit}
        `;

        logger.debug(`Found ${rows.length} spreadsheet rows (SQL ILIKE) for query: ${query}`);
        return rows;
    } catch (error) {
        logger.error(`Error searching spreadsheet: ${error}`);
        return [];
    }
}

export async function hybridRetrieval(params: {
    tenantId: string;
    query: string;
    includeInventory: boolean;
    inventoryLimit?: number;
    knowledgeLimit?: number;
    scoreThreshold?: number;
    timeout?: number;
}): Promise<RetrievalContext> {
    const {
        tenantId,
        query,
        includeInventory,
        inventoryLimit = 5,
        knowledgeLimit = 5,
        scoreThreshold = 0.7,
        timeout = 5000
    } = params;

    try {
        const startTime = Date.now();

        // Run all searches in parallel
        const retrievalPromise = Promise.all([
            includeInventory ? searchInventory(tenantId, query, inventoryLimit) : Promise.resolve([]),
            searchKnowledge(tenantId, query, knowledgeLimit, scoreThreshold),
            searchSpreadsheet(tenantId, query, inventoryLimit) // Add spreadsheet fallback
        ]);

        const timeoutPromise = new Promise<[any[], any[], any[]]>((_, reject) => {
            setTimeout(() => {
                reject(new Error('Retrieval timed out'));
            }, timeout);
        });

        // Race against the clock
        let inventoryResults: any[] = [];
        let knowledgeResults: any[] = [];
        let spreadsheetResults: any[] = [];

        try {
            [inventoryResults, knowledgeResults, spreadsheetResults] = await Promise.race([retrievalPromise, timeoutPromise]);
            const executionTime = Date.now() - startTime;
            logger.info(`Hybrid retrieval completed in ${executionTime}ms`);
        } catch (error: any) {
            if (error.message === 'Retrieval timed out') {
                logger.warn(`⚠️ hybridRetrieval timed out after ${timeout}ms. Proceeding without context.`);
                // We could return a special flag here if we wanted the AI to know it timed out
            } else {
                logger.error(`Error in hybrid retrieval: ${error.message}`);
                // Graceful degradation: return empty but don't crash
            }
            // Return empty results on failure/timeout so we don't crash the worker
            return {
                inventoryResults: [],
                knowledgeResults: [],
                totalResults: 0,
                maxRelevanceScore: 0,
            };
        }

        // Combine spreadsheet results into inventory results for simplicity
        const combinedInventory = [...inventoryResults, ...spreadsheetResults];

        // Calculate max relevance score from knowledge results
        const maxRelevanceScore = knowledgeResults.length > 0
            ? Math.max(...knowledgeResults.map(r => r.score))
            : 0;

        return {
            inventoryResults: combinedInventory,
            knowledgeResults,
            totalResults: combinedInventory.length + knowledgeResults.length,
            maxRelevanceScore, // 🆕
        };
    } catch (error) {
        logger.error(`Unexpected error in hybrid retrieval wrapper: ${error}`);
        return {
            inventoryResults: [],
            knowledgeResults: [],
            totalResults: 0,
            maxRelevanceScore: 0, // 🆕
        };
    }
}

/**
 * Format context for LLM consumption
 */
export function formatContextForLLM(context: RetrievalContext): string {
    const sections: string[] = [];

    // Format inventory results
    if (context.inventoryResults.length > 0) {
        sections.push('=== INVENTORY INFORMATION ===');
        context.inventoryResults.forEach((item: any) => {
            sections.push(
                `Product: ${item.name}\n` +
                `SKU: ${item.sku}\n` +
                `Price: ${item.currency} ${item.price}\n` +
                `Stock: ${item.stockQuantity} units\n` +
                `Description: ${item.description || 'N/A'}\n` +
                `Category: ${item.category || 'N/A'}\n`
            );
        });
    }

    // Format knowledge results
    if (context.knowledgeResults.length > 0) {
        sections.push('\n=== KNOWLEDGE BASE ===');
        context.knowledgeResults.forEach((result: any) => {
            sections.push(
                `[Relevance: ${(result.score * 100).toFixed(1)}%]\n` +
                `${result.payload.content}\n`
            );
        });
    }

    if (sections.length === 0) {
        return 'No relevant information found in the knowledge base.';
    }

    return sections.join('\n');
}
