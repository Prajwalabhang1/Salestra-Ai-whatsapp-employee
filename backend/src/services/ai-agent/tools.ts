import prisma from '../../lib/prisma.js';
import logger from '../../lib/logger.js';

/**
 * Search inventory by query
 */
export async function searchInventoryTool(tenantId: string, query: string) {
    try {
        const items = await prisma.inventoryItem.findMany({
            where: {
                tenantId,
                status: 'active',
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { sku: { contains: query, mode: 'insensitive' } },
                    { brand: { contains: query, mode: 'insensitive' } },
                    { category: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 10,
            orderBy: {
                stockQuantity: 'desc',
            },
        });

        return items.map(item => ({
            name: item.name,
            sku: item.sku,
            price: `${item.currency} ${item.price}`,
            stock: item.stockQuantity,
            description: item.description,
            category: item.category,
            brand: item.brand,
        }));
    } catch (error) {
        logger.error(`Error in searchInventoryTool: ${error}`);
        return [];
    }
}

/**
 * Get product details by SKU
 */
export async function getProductDetailsTool(tenantId: string, sku: string) {
    try {
        const item = await prisma.inventoryItem.findFirst({
            where: {
                tenantId,
                sku,
                status: 'active',
            },
        });

        if (!item) {
            return { error: 'Product not found' };
        }

        return {
            name: item.name,
            sku: item.sku,
            price: `${item.currency} ${item.price}`,
            stock: item.stockQuantity,
            description: item.description,
            category: item.category,
            brand: item.brand,
            specifications: item.specifications,
            images: item.images,
            location: item.location,
        };
    } catch (error) {
        logger.error(`Error in getProductDetailsTool: ${error}`);
        return { error: 'Failed to fetch product details' };
    }
}

/**
 * Check stock availability with alternative suggestions
 */
export async function checkStockTool(tenantId: string, sku: string, location?: string) {
    try {
        const where: any = {
            tenantId,
            sku,
            status: 'active',
        };

        if (location) {
            where.location = location;
        }

        const item = await prisma.inventoryItem.findFirst({ where });

        if (!item) {
            return {
                available: false,
                message: 'Product not found',
                error: true
            };
        }

        // ✅ IN STOCK - Return availability
        if (item.stockQuantity > 0) {
            return {
                available: true,
                stock: item.stockQuantity,
                location: item.location,
                message: `In stock: ${item.stockQuantity} units available`,
                productName: item.name,
                price: `${item.currency} ${item.price}`
            };
        }

        // ❌ OUT OF STOCK - Find alternatives
        logger.info(`[Tool] Product ${sku} out of stock, finding alternatives...`);

        const alternatives = await prisma.inventoryItem.findMany({
            where: {
                tenantId,
                status: 'active',
                category: item.category, // Same category
                stockQuantity: { gt: 0 }, // In stock
                id: { not: item.id } // Exclude current item
            },
            take: 3,
            orderBy: [
                { stockQuantity: 'desc' }, // Prioritize high stock
                { price: 'asc' } // Then sort by price
            ]
        });

        // Extract expected restock date from metadata if available
        const expectedRestock = (item.metadata as any)?.expectedRestockDate || null;

        return {
            available: false,
            stock: 0,
            message: 'Out of stock',
            productName: item.name,
            category: item.category,
            expectedRestock,
            alternatives: alternatives.length > 0 ? alternatives.map(alt => ({
                name: alt.name,
                sku: alt.sku,
                price: `${alt.currency} ${alt.price}`,
                stock: alt.stockQuantity,
                category: alt.category
            })) : null
        };
    } catch (error) {
        logger.error(`Error in checkStockTool: ${error}`);
        return {
            available: false,
            message: 'Failed to check stock',
            error: true
        };
    }
}

/**
 * Escalate to human agent
 */
export async function escalateToHumanTool(
    conversationId: string,
    reason: string,
    urgency: 'low' | 'medium' | 'high' = 'medium'
) {
    try {
        // Update conversation status
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: 'escalated',
                assignedTo: 'human',
                escalationReason: reason,
            },
        });

        logger.info(`Escalated conversation ${conversationId} to human. Reason: ${reason}`);

        return {
            success: true,
            message: "I've connected you with our team. Someone will assist you shortly!",
            urgency,
        };
    } catch (error) {
        logger.error(`Error in escalateToHumanTool: ${error}`);
        return {
            success: false,
            message: 'Failed to escalate to human',
        };
    }
}

/**
 * Tool definitions for OpenAI function calling
 */
export const AI_TOOLS = [
    {
        type: 'function' as const,
        function: {
            name: 'search_inventory',
            description: 'Search for products in the business inventory by name, SKU, brand, or category',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query (product name, SKU, brand, or category)',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_product_details',
            description: 'Get detailed information about a specific product by its SKU',
            parameters: {
                type: 'object',
                properties: {
                    sku: {
                        type: 'string',
                        description: 'The product SKU code',
                    },
                },
                required: ['sku'],
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'check_stock',
            description: 'Check real-time stock availability for a product. If out of stock, automatically provides alternative product suggestions in the same category.',
            parameters: {
                type: 'object',
                properties: {
                    sku: {
                        type: 'string',
                        description: 'The product SKU code',
                    },
                    location: {
                        type: 'string',
                        description: 'Optional: Check stock at a specific location (store/warehouse)',
                    },
                },
                required: ['sku'],
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'escalate_to_human',
            description: 'Transfer the conversation to a human agent when unable to help or customer explicitly requests it',
            parameters: {
                type: 'object',
                properties: {
                    reason: {
                        type: 'string',
                        description: 'The reason for escalation',
                    },
                    urgency: {
                        type: 'string',
                        enum: ['low', 'medium', 'high'],
                        description: 'The urgency level of the escalation',
                    },
                },
                required: ['reason'],
            },
        },
    },
];

/**
 * Execute a tool call
 */
export async function executeTool(
    toolName: string,
    args: any,
    tenantId: string,
    conversationId: string
): Promise<any> {
    switch (toolName) {
        case 'search_inventory':
            return searchInventoryTool(tenantId, args.query);

        case 'get_product_details':
            return getProductDetailsTool(tenantId, args.sku);

        case 'check_stock':
            return checkStockTool(tenantId, args.sku, args.location);

        case 'escalate_to_human':
            return escalateToHumanTool(conversationId, args.reason, args.urgency);

        default:
            logger.warn(`Unknown tool: ${toolName}`);
            return { error: 'Unknown tool' };
    }
}
