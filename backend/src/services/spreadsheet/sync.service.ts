import logger from '../../lib/logger.js';
import { generateEmbedding } from '../rag/embedding.service.js';
import { upsertVectors, getTenantCollectionName } from '../rag/vector-store.service.js';
import qdrant from '../../lib/qdrant.js';

/**
 * Sync a spreadsheet row to vector store
 * Works with ANY column structure - converts JSONB data to searchable text
 */
export async function syncSpreadsheetRowToVector(
    rowId: string,
    tenantId: string,
    data: Record<string, any>
): Promise<void> {
    try {
        // Convert flexible JSONB data to natural language text
        const textParts: string[] = [];

        for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== undefined && value !== '') {
                // Format: "Column Name: value"
                textParts.push(`${key}: ${value}`);
            }
        }

        const documentText = textParts.join(', ');

        if (!documentText) {
            logger.warn(`Row ${rowId} has no content to sync`);
            return;
        }

        // Generate embedding
        const embedding = await generateEmbedding(documentText);

        // Upsert to Qdrant
        await upsertVectors(tenantId, [{
            vector: embedding,
            payload: {
                tenantId,
                documentId: rowId,
                source: 'spreadsheet',
                content: documentText,
                metadata: {
                    rowId,
                    type: 'spreadsheet_row',
                    ...data // Store full data for retrieval context
                }
            }
        }]);

        logger.info(`✅ Synced spreadsheet row ${rowId} to vector store`);
    } catch (error: any) {
        logger.error(`Failed to sync spreadsheet row ${rowId}: ${error.message}`);
        throw error;
    }
}

/**
 * Delete spreadsheet row from vector store
 */
export async function deleteSpreadsheetRowFromVector(tenantId: string, rowId: string): Promise<void> {
    try {
        const collectionName = getTenantCollectionName(tenantId);

        // Find points by documentId (rowId)
        await qdrant.delete(collectionName, {
            wait: true,
            filter: {
                must: [
                    {
                        key: 'documentId',
                        match: { value: rowId }
                    }
                ]
            }
        });

        logger.info(`Deleted spreadsheet row ${rowId} from vector store`);
    } catch (error: any) {
        logger.error(`Failed to delete spreadsheet row ${rowId} from vector: ${error.message}`);
        // Don't throw if just cleanup
    }
}
