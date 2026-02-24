import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * GET /api/leads
 * Get all leads for the tenant with pagination, sorting, and filtering
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;

        // Pagination
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100
        const skip = (page - 1) * limit;

        // Sorting
        const sortBy = (req.query.sortBy as string) || 'lastContact';
        const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

        // Filtering
        const status = req.query.status as string;
        const search = req.query.search as string;

        // Build where clause
        const where: any = { tenantId };

        if (status && status !== 'all') {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { customerName: { contains: search, mode: 'insensitive' } },
                { customerPhone: { contains: search } },
                { customerEmail: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Get total count for pagination
        const totalCount = await prisma.lead.count({ where });

        // Get leads
        const leads = await prisma.lead.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy]: order },
            select: {
                id: true,
                customerName: true,
                customerPhone: true,
                customerEmail: true,
                status: true,
                intent: true,
                interactionCount: true,
                lastContact: true,
                source: true,
                notes: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.json({
            success: true,
            leads,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasMore: skip + leads.length < totalCount
            }
        });
    } catch (error: any) {
        logger.error(`Get leads error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

/**
 * PATCH /api/leads/:id
 * Update a lead's status, notes, or other fields
 */
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;
        const { id } = req.params;
        const { status, notes, customerName, customerEmail } = req.body;

        // Verify lead exists and belongs to tenant
        const existingLead = await prisma.lead.findFirst({
            where: { id, tenantId }
        });

        if (!existingLead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Validate status if provided
        const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        // Update lead
        const updateData: any = { updatedAt: new Date() };
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (customerName) updateData.customerName = customerName;
        if (customerEmail) updateData.customerEmail = customerEmail;

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                customerName: true,
                customerPhone: true,
                customerEmail: true,
                status: true,
                intent: true,
                interactionCount: true,
                lastContact: true,
                source: true,
                notes: true,
                createdAt: true,
                updatedAt: true
            }
        });

        logger.info(`Lead ${id} updated by tenant ${tenantId}`);
        res.json({ success: true, lead: updatedLead });
    } catch (error: any) {
        logger.error(`Update lead error: ${error.message}`);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

/**
 * DELETE /api/leads/:id
 * Delete a lead
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;
        const { id } = req.params;

        // Verify lead exists and belongs to tenant
        const existingLead = await prisma.lead.findFirst({
            where: { id, tenantId }
        });

        if (!existingLead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Delete lead
        await prisma.lead.delete({ where: { id } });

        logger.info(`Lead ${id} deleted by tenant ${tenantId}`);
        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error: any) {
        logger.error(`Delete lead error: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

/**
 * GET /api/leads/export/csv
 * Export leads to CSV
 */
router.get('/export/csv', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;

        // Get filters (same as list endpoint)
        const status = req.query.status as string;
        const search = req.query.search as string;

        // Build where clause
        const where: any = { tenantId };
        if (status && status !== 'all') {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { customerName: { contains: search, mode: 'insensitive' } },
                { customerPhone: { contains: search } },
                { customerEmail: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Get all matching leads
        const leads = await prisma.lead.findMany({
            where,
            orderBy: { lastContact: 'desc' },
            select: {
                customerName: true,
                customerPhone: true,
                customerEmail: true,
                status: true,
                intent: true,
                interactionCount: true,
                lastContact: true,
                notes: true,
                source: true,
                createdAt: true
            }
        });

        // Generate CSV
        const csvHeaders = [
            'Name',
            'Phone',
            'Email',
            'Status',
            'Intent',
            'Interactions',
            'Last Contact',
            'Notes',
            'Source',
            'Created'
        ];

        const csvRows = leads.map(lead => [
            lead.customerName || '',
            lead.customerPhone || '',
            lead.customerEmail || '',
            lead.status || '',
            lead.intent || '',
            lead.interactionCount || 0,
            lead.lastContact ? new Date(lead.lastContact).toISOString() : '',
            (lead.notes || '').replace(/"/g, '""'), // Escape quotes
            lead.source || '',
            lead.createdAt ? new Date(lead.createdAt).toISOString() : ''
        ]);

        // Build CSV content
        const csvContent = [
            csvHeaders.map(h => `"${h}"`).join(','),
            ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Set headers for download
        const timestamp = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="leads-${timestamp}.csv"`);
        res.send(csvContent);

        logger.info(`Leads exported to CSV by tenant ${tenantId} (${leads.length} leads)`);
    } catch (error: any) {
        logger.error(`Export leads error: ${error.message}`);
        res.status(500).json({ error: 'Failed to export leads' });
    }
});

/**
 * POST /api/leads/bulk-update
 * Bulk update multiple leads
 */
router.post('/bulk-update', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.userId;
        const { leadIds, action, value } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'Lead IDs are required' });
        }

        if (leadIds.length > 100) {
            return res.status(400).json({ error: 'Maximum 100 leads at once' });
        }

        let result;

        switch (action) {
            case 'updateStatus':
                const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
                if (!validStatuses.includes(value)) {
                    return res.status(400).json({ error: 'Invalid status value' });
                }

                result = await prisma.lead.updateMany({
                    where: {
                        id: { in: leadIds },
                        tenantId
                    },
                    data: {
                        status: value,
                        updatedAt: new Date()
                    }
                });
                break;

            case 'delete':
                result = await prisma.lead.deleteMany({
                    where: {
                        id: { in: leadIds },
                        tenantId
                    }
                });
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        logger.info(`Bulk ${action} performed by tenant ${tenantId} on ${result.count} leads`);
        res.json({
            success: true,
            count: result.count,
            message: `Successfully ${action === 'delete' ? 'deleted' : 'updated'} ${result.count} leads`
        });
    } catch (error: any) {
        logger.error(`Bulk update leads error: ${error.message}`);
        res.status(500).json({ error: 'Failed to perform bulk operation' });
    }
});

export default router;
