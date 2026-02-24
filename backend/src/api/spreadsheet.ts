import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { syncSpreadsheetRowToVector } from '../services/spreadsheet/sync.service.js';

const router = Router();

/**
 * GET /api/spreadsheet
 * Get spreadsheet data with flexible columns
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { sheet_id } = req.query;

        // Get or create default sheet
        let sheet = await prisma.sheetMetadata.findFirst({
            where: { tenantId }
        });

        if (!sheet) {
            // Create default sheet with empty columns
            sheet = await prisma.sheetMetadata.create({
                data: {
                    tenantId,
                    name: 'Products Database',
                    columns: []
                }
            });
        }

        // Get all rows for this sheet
        const rows = await prisma.spreadsheetData.findMany({
            where: {
                tenantId,
                sheetId: sheet.id
            },
            orderBy: { rowNumber: 'asc' }
        });

        // Extract column names from sheet metadata or infer from data
        let columns: string[] = [];
        if (Array.isArray(sheet.columns) && sheet.columns.length > 0) {
            columns = (sheet.columns as any[]).map((col: any) =>
                typeof col === 'string' ? col : col.name
            );
        } else if (rows.length > 0) {
            // Infer columns from first row
            columns = Object.keys(rows[0].data as any);
        }

        res.json({
            success: true,
            sheet: {
                id: sheet.id,
                name: sheet.name,
                columns
            },
            rows: rows.map(row => ({
                id: row.id,
                rowNumber: row.rowNumber,
                ...row.data as any
            })),
            totalRows: rows.length
        });
    } catch (error: any) {
        logger.error(`Error fetching spreadsheet: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch spreadsheet' });
    }
});

/**
 * POST /api/spreadsheet/import
 * Import Excel file with ANY column structure
 */
router.post('/import', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { columns, rows, sheetName } = req.body;

        if (!columns || !Array.isArray(columns) || !rows || !Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request: columns and rows arrays required'
            });
        }

        // Get or create sheet
        let sheet = await prisma.sheetMetadata.findFirst({
            where: { tenantId }
        });

        if (sheet) {
            // Update existing sheet
            sheet = await prisma.sheetMetadata.update({
                where: { id: sheet.id },
                data: {
                    name: sheetName || sheet.name,
                    columns: columns.map((name, i) => ({ name, order: i })),
                    rowCount: rows.length
                }
            });

            // Delete existing rows
            await prisma.spreadsheetData.deleteMany({
                where: {
                    tenantId,
                    sheetId: sheet.id
                }
            });
        } else {
            // Create new sheet
            sheet = await prisma.sheetMetadata.create({
                data: {
                    tenantId,
                    name: sheetName || 'Imported Data',
                    columns: columns.map((name, i) => ({ name, order: i })),
                    rowCount: rows.length
                }
            });
        }

        // Insert all rows
        const insertedRows = [];
        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];

            const createdRow = await prisma.spreadsheetData.create({
                data: {
                    tenantId,
                    sheetId: sheet.id,
                    rowNumber: i + 1,
                    data: rowData
                }
            });

            insertedRows.push(createdRow);

            // Sync to vector store async (don't wait)
            syncSpreadsheetRowToVector(createdRow.id, tenantId, rowData).catch(err => {
                logger.error(`Failed to sync row ${createdRow.id} to vector: ${err.message}`);
            });
        }

        logger.info(`Imported ${rows.length} rows for tenant ${tenantId}`);

        res.json({
            success: true,
            imported: rows.length,
            sheet: {
                id: sheet.id,
                name: sheet.name,
                columns
            }
        });
    } catch (error: any) {
        logger.error(`Error importing spreadsheet: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to import spreadsheet' });
    }
});

/**
 * POST /api/spreadsheet/row
 * Add a new row with flexible data
 */
router.post('/row', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { data } = req.body;

        if (!data || typeof data !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid request: data object required'
            });
        }

        // Get or create sheet
        let sheet = await prisma.sheetMetadata.findFirst({
            where: { tenantId }
        });

        if (!sheet) {
            // Create sheet with columns from data
            const columns = Object.keys(data);
            sheet = await prisma.sheetMetadata.create({
                data: {
                    tenantId,
                    name: 'Products Database',
                    columns: columns.map((name, i) => ({ name, order: i })),
                    rowCount: 1
                }
            });
        } else {
            // Update column list if new columns detected
            const existingColumns = new Set((sheet.columns as any[]).map((c: any) => c.name));
            const newColumns = Object.keys(data).filter(k => !existingColumns.has(k));

            if (newColumns.length > 0) {
                const updatedColumns = [
                    ...sheet.columns as any[],
                    ...newColumns.map((name, i) => ({ name, order: (sheet.columns as any[]).length + i }))
                ];

                await prisma.sheetMetadata.update({
                    where: { id: sheet.id },
                    data: { columns: updatedColumns }
                });
            }

            // Increment row count
            await prisma.sheetMetadata.update({
                where: { id: sheet.id },
                data: { rowCount: { increment: 1 } }
            });
        }

        // Get next row number
        const lastRow = await prisma.spreadsheetData.findFirst({
            where: { tenantId, sheetId: sheet.id },
            orderBy: { rowNumber: 'desc' }
        });

        const rowNumber = lastRow ? lastRow.rowNumber + 1 : 1;

        // Create row
        const createdRow = await prisma.spreadsheetData.create({
            data: {
                tenantId,
                sheetId: sheet.id,
                rowNumber,
                data
            }
        });

        // Sync to vector store
        syncSpreadsheetRowToVector(createdRow.id, tenantId, data).catch(err => {
            logger.error(`Failed to sync row to vector: ${err.message}`);
        });

        res.json({
            success: true,
            row: {
                id: createdRow.id,
                rowNumber: createdRow.rowNumber,
                ...createdRow.data as any
            }
        });
    } catch (error: any) {
        logger.error(`Error creating spreadsheet row: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to create row' });
    }
});

/**
 * PUT /api/spreadsheet/row/:id
 * Update a row with flexible data
 */
router.put('/row/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { id } = req.params;
        const { data } = req.body;

        if (!data || typeof data !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid request: data object required'
            });
        }

        // Update row
        const updatedRow = await prisma.spreadsheetData.update({
            where: { id },
            data: {
                data,
                updatedAt: new Date()
            }
        });

        // Re-sync to vector store
        syncSpreadsheetRowToVector(id, tenantId, data).catch(err => {
            logger.error(`Failed to sync row to vector: ${err.message}`);
        });

        res.json({
            success: true,
            row: {
                id: updatedRow.id,
                rowNumber: updatedRow.rowNumber,
                ...updatedRow.data as any
            }
        });
    } catch (error: any) {
        logger.error(`Error updating spreadsheet row: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to update row' });
    }
});

/**
 * DELETE /api/spreadsheet/row/:id
 * Delete a row
 */
router.delete('/row/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.spreadsheetData.delete({
            where: { id }
        });

        res.json({ success: true });
    } catch (error: any) {
        logger.error(`Error deleting spreadsheet row: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to delete row' });
    }
});

/**
 * PUT /api/spreadsheet/columns
 * Update column metadata (add/remove/rename columns)
 */
router.put('/columns', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId!;
        const { columns } = req.body;

        if (!columns || !Array.isArray(columns)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request: columns array required'
            });
        }

        // Get sheet
        const sheet = await prisma.sheetMetadata.findFirst({
            where: { tenantId }
        });

        if (!sheet) {
            return res.status(404).json({
                success: false,
                error: 'Sheet not found'
            });
        }

        // Update columns
        await prisma.sheetMetadata.update({
            where: { id: sheet.id },
            data: {
                columns: columns.map((name, i) => ({ name, order: i }))
            }
        });

        res.json({ success: true, columns });
    } catch (error: any) {
        logger.error(`Error updating columns: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to update columns' });
    }
});

export default router;
