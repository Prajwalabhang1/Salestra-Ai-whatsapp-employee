import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { syncInventoryItemToVectorStore, deleteInventoryItemFromVectorStore } from '../services/inventory/sync.service.js';

const router = Router();

/**
 * GET /api/inventory
 * List all inventory items with filters
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { category, search, stockStatus, limit = '50', offset = '0' } = req.query;

        const where: any = {
            tenantId,
            status: 'active'
        };

        if (category) {
            where.category = category as string;
        }

        if (stockStatus) {
            if (stockStatus === 'in_stock') {
                where.stockQuantity = { gt: 5 };
            } else if (stockStatus === 'low_stock') {
                where.stockQuantity = { gt: 0, lte: 5 };
            } else if (stockStatus === 'out_of_stock') {
                where.stockQuantity = 0;
            }
        }

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } },
                { sku: { contains: search as string, mode: 'insensitive' } },
                { brand: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const items = await prisma.inventoryItem.findMany({
            where,
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
            orderBy: { createdAt: 'desc' },
        });

        const total = await prisma.inventoryItem.count({ where });

        res.json({
            success: true,
            items,
            pagination: {
                total,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            }
        });
    } catch (error: any) {
        logger.error(`Error fetching inventory: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
    }
});

/**
 * POST /api/inventory
 * Create new inventory item and sync to vector store
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const {
            sku,
            name,
            description,
            category,
            brand,
            price,
            currency = 'INR',
            stockQuantity = 0,
            location,
            images,
            specifications
        } = req.body;

        // Validation
        if (!sku || !name || !price) {
            return res.status(400).json({
                success: false,
                error: 'SKU, name, and price are required'
            });
        }

        // Check if SKU already exists for this tenant
        const existing = await prisma.inventoryItem.findFirst({
            where: { tenantId, sku }
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'SKU already exists'
            });
        }

        // Create item
        const item = await prisma.inventoryItem.create({
            data: {
                tenantId,
                sku,
                name,
                description,
                category,
                brand,
                price,
                currency,
                stockQuantity,
                location,
                images,
                specifications,
                status: 'active'
            }
        });

        // Sync to vector store (async, don't wait)
        syncInventoryItemToVectorStore(item).catch(err =>
            logger.error(`Failed to sync new item ${item.id} to vector store: ${err.message}`)
        );

        logger.info(`Created inventory item ${item.id} for tenant ${tenantId}`);

        res.status(201).json({
            success: true,
            item
        });
    } catch (error: any) {
        logger.error(`Error creating inventory item: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to create item' });
    }
});

/**
 * PUT /api/inventory/:id
 * Update inventory item and re-sync to vector store
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { id } = req.params;
        const updates = req.body;

        // Check ownership
        const existing = await prisma.inventoryItem.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        // Update item
        const item = await prisma.inventoryItem.update({
            where: { id },
            data: {
                ...updates,
                updatedAt: new Date()
            }
        });

        // Re-sync to vector store (async)
        syncInventoryItemToVectorStore(item).catch(err =>
            logger.error(`Failed to re-sync updated item ${item.id}: ${err.message}`)
        );

        logger.info(`Updated inventory item ${id} for tenant ${tenantId}`);

        res.json({
            success: true,
            item
        });
    } catch (error: any) {
        logger.error(`Error updating inventory item: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to update item' });
    }
});

/**
 * DELETE /api/inventory/:id
 * Delete inventory item and remove from vector store
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { id } = req.params;

        // Check ownership
        const existing = await prisma.inventoryItem.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        // Delete from vector store first
        if (existing.vectorId) {
            await deleteInventoryItemFromVectorStore(tenantId, existing.vectorId);
        }

        // Delete from database
        await prisma.inventoryItem.delete({ where: { id } });

        logger.info(`Deleted inventory item ${id} for tenant ${tenantId}`);

        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error: any) {
        logger.error(`Error deleting inventory item: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to delete item' });
    }
});

/**
 * GET /api/inventory/categories
 * Get list of all categories for this tenant
 */
router.get('/categories', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;

        const categories = await prisma.inventoryItem.groupBy({
            by: ['category'],
            where: {
                tenantId,
                status: 'active',
                category: { not: null }
            },
            _count: true
        });

        res.json({
            success: true,
            categories: categories.map(c => ({
                name: c.category,
                count: c._count
            }))
        });
    } catch (error: any) {
        logger.error(`Error fetching categories: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
});

/**
 * POST /api/inventory/bulk
 * Bulk insert inventory items (for Excel import)
 */
router.post('/bulk', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required and cannot be empty'
            });
        }

        const results = {
            inserted: 0,
            failed: 0,
            errors: [] as Array<{ row: number; error: string }>
        };

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            try {
                // Validation
                if (!item.sku || !item.name || item.price == null) {
                    throw new Error('SKU, name, and price are required');
                }

                // Check for duplicate SKU
                const existing = await prisma.inventoryItem.findFirst({
                    where: { tenantId, sku: item.sku }
                });

                if (existing) {
                    throw new Error(`SKU '${item.sku}' already exists`);
                }

                // Create item
                const newItem = await prisma.inventoryItem.create({
                    data: {
                        tenantId,
                        sku: item.sku,
                        name: item.name,
                        description: item.description || null,
                        category: item.category || null,
                        brand: item.brand || null,
                        price: parseFloat(item.price),
                        currency: item.currency || 'INR',
                        stockQuantity: parseInt(item.stockQuantity || 0),
                        location: item.location || null,
                        status: 'active'
                    }
                });

                // Sync to vector store (async, don't wait)
                syncInventoryItemToVectorStore(newItem).catch(err =>
                    logger.error(`Failed to sync bulk item ${newItem.id}: ${err.message}`)
                );

                results.inserted++;
            } catch (error: any) {
                results.failed++;
                results.errors.push({
                    row: i + 1,
                    error: error.message
                });
            }
        }

        logger.info(`Bulk insert completed for tenant ${tenantId}: ${results.inserted} inserted, ${results.failed} failed`);

        res.status(200).json({
            success: true,
            ...results
        });
    } catch (error: any) {
        logger.error(`Bulk insert error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Bulk insert failed' });
    }
});

/**
 * PUT /api/inventory/bulk
 * Bulk update inventory items
 */
router.put('/bulk', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Updates array is required'
            });
        }

        let updated = 0;
        const errors: Array<{ id: string; error: string }> = [];

        for (const update of updates) {
            try {
                const { id, field, value } = update;

                // Check ownership
                const existing = await prisma.inventoryItem.findFirst({
                    where: { id, tenantId }
                });

                if (!existing) {
                    throw new Error('Item not found');
                }

                // Update
                const item = await prisma.inventoryItem.update({
                    where: { id },
                    data: {
                        [field]: value,
                        updatedAt: new Date()
                    }
                });

                // Re-sync to vector store if content changed
                if (['name', 'description', 'category', 'brand', 'price', 'stockQuantity'].includes(field)) {
                    syncInventoryItemToVectorStore(item).catch(err =>
                        logger.error(`Failed to re-sync item ${id}: ${err.message}`)
                    );
                }

                updated++;
            } catch (error: any) {
                errors.push({
                    id: update.id,
                    error: error.message
                });
            }
        }

        logger.info(`Bulk update completed for tenant ${tenantId}: ${updated} updated, ${errors.length} failed`);

        res.json({
            success: true,
            updated,
            failed: errors.length,
            errors
        });
    } catch (error: any) {
        logger.error(`Bulk update error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Bulk update failed' });
    }
});

/**
 * DELETE /api/inventory/bulk
 * Bulk delete inventory items
 */
router.delete('/bulk', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'IDs array is required'
            });
        }

        let deleted = 0;
        const errors: Array<{ id: string; error: string }> = [];

        for (const id of ids) {
            try {
                // Check ownership
                const existing = await prisma.inventoryItem.findFirst({
                    where: { id, tenantId }
                });

                if (!existing) {
                    throw new Error('Item not found');
                }

                // Delete from vector store first
                if (existing.vectorId) {
                    await deleteInventoryItemFromVectorStore(tenantId, existing.vectorId);
                }

                // Delete from database
                await prisma.inventoryItem.delete({ where: { id } });

                deleted++;
            } catch (error: any) {
                errors.push({
                    id,
                    error: error.message
                });
            }
        }

        logger.info(`Bulk delete completed for tenant ${tenantId}: ${deleted} deleted, ${errors.length} failed`);

        res.json({
            success: true,
            deleted,
            failed: errors.length,
            errors
        });
    } catch (error: any) {
        logger.error(`Bulk delete error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Bulk delete failed' });
    }
});

export default router;

