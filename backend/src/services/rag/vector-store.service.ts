import qdrant from '../../lib/qdrant.js';
import logger from '../../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';

const VECTOR_DIMENSION = 3072; // OpenAI text-embedding-3-large

export interface VectorPoint {
    id: string;
    vector: number[];
    payload: {
        tenantId: string;
        documentId: string;
        content: string;
        source?: string;
        type?: string;
        metadata: Record<string, any>;
    };
}

/**
 * Get collection name for tenant
 */
export function getTenantCollectionName(tenantId: string): string {
    return `salestra_tenant_${tenantId}`;
}

/**
 * Create collection for tenant (if not exists)
 */
export async function ensureTenantCollection(tenantId: string): Promise<void> {
    const collectionName = getTenantCollectionName(tenantId);

    try {
        // Check if collection exists
        const collections = await qdrant.getCollections();
        const exists = collections.collections.some(c => c.name === collectionName);

        if (!exists) {
            await qdrant.createCollection(collectionName, {
                vectors: {
                    size: VECTOR_DIMENSION,
                    distance: 'Cosine',
                },
            });
            logger.info(`Created vector collection for tenant: ${tenantId}`);
        }
    } catch (error: any) {
        logger.error(`Error ensuring collection: ${error.message}`);
        throw error;
    }
}

/**
 * Upsert vectors into tenant collection
 */
export async function upsertVectors(
    tenantId: string,
    points: Omit<VectorPoint, 'id'>[]
): Promise<string[]> {
    const collectionName = getTenantCollectionName(tenantId);

    try {
        await ensureTenantCollection(tenantId);

        const vectorPoints = points.map(point => ({
            id: uuidv4(),
            vector: point.vector,
            payload: {
                ...point.payload,
                tenantId, // Ensure tenant ID is always in payload
            },
        }));

        await qdrant.upsert(collectionName, {
            wait: true,
            points: vectorPoints,
        });

        const ids = vectorPoints.map(p => p.id);
        logger.info(`Upserted ${ids.length} vectors for tenant ${tenantId}`);

        return ids;
    } catch (error: any) {
        logger.error(`Error upserting vectors: ${error.message}`);
        throw error;
    }
}

/**
 * Search vectors by similarity
 */
export async function searchVectors(
    tenantId: string,
    queryVector: number[],
    limit: number = 5,
    scoreThreshold: number = 0.7
): Promise<Array<{ id: string; score: number; payload: any }>> {
    const collectionName = getTenantCollectionName(tenantId);

    try {
        const searchResult = await qdrant.search(collectionName, {
            vector: queryVector,
            limit,
            score_threshold: scoreThreshold,
            with_payload: true,
        });

        const results = searchResult.map(result => ({
            id: result.id as string,
            score: result.score,
            payload: result.payload,
        }));

        logger.debug(`Found ${results.length} similar vectors for tenant ${tenantId}`);
        return results;
    } catch (error: any) {
        logger.error(`Error searching vectors: ${error.message}`);
        throw error;
    }
}

/**
 * Delete vectors by document ID
 */
export async function deleteVectorsByDocument(
    tenantId: string,
    documentId: string
): Promise<void> {
    const collectionName = getTenantCollectionName(tenantId);

    try {
        await qdrant.delete(collectionName, {
            wait: true,
            filter: {
                must: [
                    {
                        key: 'documentId',
                        match: { value: documentId },
                    },
                ],
            },
        });

        logger.info(`Deleted vectors for document ${documentId} in tenant ${tenantId}`);
    } catch (error: any) {
        logger.error(`Error deleting vectors: ${error.message}`);
        throw error;
    }
}

/**
 * Delete entire tenant collection
 */
export async function deleteTenantCollection(tenantId: string): Promise<void> {
    const collectionName = getTenantCollectionName(tenantId);

    try {
        await qdrant.deleteCollection(collectionName);
        logger.info(`Deleted collection for tenant: ${tenantId}`);
    } catch (error: any) {
        logger.error(`Error deleting collection: ${error.message}`);
        throw error;
    }
}

/**
 * Get collection statistics
 */
export async function getCollectionStats(tenantId: string): Promise<any> {
    const collectionName = getTenantCollectionName(tenantId);

    try {
        const info = await qdrant.getCollection(collectionName);
        return {
            vectorCount: info.points_count,
            status: info.status,
        };
    } catch (error: any) {
        logger.error(`Error getting collection stats: ${error.message}`);
        return { vectorCount: 0, status: 'not_found' };
    }
}
