import prisma from '../../lib/prisma.js';
import logger from '../../lib/logger.js';
import { generateEmbedding } from '../rag/embedding.service.js';
import { upsertVectors, getTenantCollectionName } from '../rag/vector-store.service.js';
import qdrant from '../../lib/qdrant.js';
import { InventoryItem } from '@prisma/client';

/**
 * Format inventory item for vector embedding
 */
export function formatInventoryItemForEmbedding(item: InventoryItem): string {
    const parts = [
        item.name,
        item.brand,
        item.category,
        `SKU: ${item.sku}`,
        `Price: ${item.currency} ${item.price}`,
        `Stock: ${item.stockQuantity} units`,
        item.description,
        item.specifications ? Object.entries(item.specifications as any)
            .map(([k, v]) => `${k}: ${v}`).join(', ') : null
    ].filter(Boolean);

    return parts.join('. ');
}

/**
 * Sync single inventory item to vector store
 */
export async function syncInventoryItemToVectorStore(item: InventoryItem): Promise<void> {
    try {
        logger.info(`Syncing inventory item ${item.id} to vector store...`);

        // Format item for embedding
        const content = formatInventoryItemForEmbedding(item);

        // Generate embedding
        const embedding = await generateEmbedding(content);

        // Create vector for Qdrant
        const vectors = [{
            vector: embedding,
            payload: {
                tenantId: item.tenantId,
                documentId: item.id,
                source: 'inventory',
                type: 'product',
                content,
                metadata: {
                    itemId: item.id,
                    productName: item.name,
                    sku: item.sku,
                    category: item.category,
                    brand: item.brand,
                    price: item.price.toString(),
                    currency: item.currency,
                    stockQuantity: item.stockQuantity,
                    status: item.status,
                }
            }
        }];

        // Upsert to vector store
        const vectorIds = await upsertVectors(item.tenantId, vectors);

        // Update item with vector sync status
        await prisma.inventoryItem.update({
            where: { id: item.id },
            data: {
                vectorSynced: true,
                vectorId: vectorIds[0],
                lastSyncedAt: new Date()
            }
        });

        logger.info(`Successfully synced inventory item ${item.id} with vector ID ${vectorIds[0]}`);
    } catch (error: any) {
        logger.error(`Failed to sync inventory item ${item.id}: ${error.message}`);

        // Update status to show sync failed
        await prisma.inventoryItem.update({
            where: { id: item.id },
            data: { vectorSynced: false }
        }).catch(() => { }); // Ignore errors on error handling

        throw error;
    }
}

/**
 * Delete inventory item from vector store
 */
export async function deleteInventoryItemFromVectorStore(tenantId: string, vectorId: string): Promise<void> {
    try {
        const collectionName = getTenantCollectionName(tenantId);

        await qdrant.delete(collectionName, {
            wait: true,
            points: [vectorId]
        });

        logger.info(`Deleted vector ${vectorId} from ${collectionName}`);
    } catch (error: any) {
        logger.error(`Failed to delete vector ${vectorId}: ${error.message}`);
        throw error;
    }
}

/**
 * Bulk sync all inventory items for a tenant
 */
export async function bulkSyncInventoryItems(tenantId: string): Promise<{ synced: number; failed: number }> {
    try {
        logger.info(`Starting bulk inventory sync for tenant ${tenantId}...`);

        const items = await prisma.inventoryItem.findMany({
            where: {
                tenantId,
                status: 'active'
            }
        });

        let synced = 0;
        let failed = 0;

        for (const item of items) {
            try {
                await syncInventoryItemToVectorStore(item);
                synced++;
            } catch (error) {
                failed++;
                logger.error(`Failed to sync item ${item.id} ${item.name}: ${error}`);
            }
        }

        logger.info(`Bulk sync completed: ${synced} synced, ${failed} failed`);

        return { synced, failed };
    } catch (error: any) {
        logger.error(`Bulk sync error: ${error.message}`);
        throw error;
    }
}
