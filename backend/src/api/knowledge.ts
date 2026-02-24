import { Router, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = './uploads/knowledge';
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, TXT, and DOCX are allowed.'));
        }
    }
});

/**
 * POST /api/knowledge/upload
 * Upload a file to the knowledge base
 */
router.post('/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Save document metadata to database
        const document = await prisma.knowledgeDocument.create({
            data: {
                tenantId,
                title: file.originalname,
                content: '', // Will be extracted later
                docType: 'file',
                metadata: {
                    format: path.extname(file.originalname).slice(1),
                    source: 'upload',
                    filePath: file.path,
                    fileSize: file.size,
                    processedStatus: 'pending'
                },
                embeddingStatus: 'pending'
            }
        });

        logger.info(`Knowledge document uploaded: ${document.id} by tenant ${tenantId}`);

        res.json({
            success: true,
            document: {
                id: document.id,
                title: document.title,
                format: (document.metadata as any)?.format
            }
        });
    } catch (error: any) {
        logger.error(`Knowledge upload error: ${error.message}`);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

/**
 * POST /api/knowledge/text
 * Add text-based knowledge directly
 */
router.post('/text', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId;
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const document = await prisma.knowledgeDocument.create({
            data: {
                tenantId,
                title,
                content,
                docType: 'text',
                metadata: {
                    format: 'text',
                    source: 'manual',
                    processedStatus: 'processed'
                },
                embeddingStatus: 'pending'
            }
        });

        logger.info(`Text knowledge added: ${document.id} by tenant ${tenantId}`);

        res.json({
            success: true,
            document: {
                id: document.id,
                title: document.title
            }
        });
    } catch (error: any) {
        logger.error(`Text knowledge error: ${error.message}`);
        res.status(500).json({ error: 'Failed to add knowledge' });
    }
});

/**
 * GET /api/knowledge
 * Get all knowledge documents for a tenant
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
        const tenantId = (req as AuthRequest).userId;

        const documents = await prisma.knowledgeDocument.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                docType: true,
                metadata: true,
                createdAt: true,
            }
        });

        res.json({ success: true, documents });
    } catch (error: any) {
        logger.error(`Get knowledge error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch knowledge' });
    }
});

export default router;
