import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { sseService } from '../services/events/sse.service.js';
import logger from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * SSE endpoint for real-time conversation updates
 * Clients connect to this endpoint to receive instant notifications
 * 
 * Note: EventSource doesn't support custom headers, so we accept token via query param
 */
router.get('/conversations', (req: Request, res: Response) => {
    // Get token from query parameter (EventSource limitation)
    const token = req.query.token as string;

    if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    // Verify JWT token
    let tenantId: string;
    try {
        const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
        const decoded = jwt.verify(token, jwtSecret) as { userId: string };
        tenantId = decoded.userId;
        logger.info(`🔌 SSE connection request from tenant: ${tenantId}`);
    } catch (error: any) {
        logger.error(`❌ Invalid token for SSE: ${error.message}`);
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    const clientId = uuidv4();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Disable compression for SSE
    res.flushHeaders();

    // Add connection to SSE service
    sseService.addConnection(tenantId, res, clientId);

    // Handle client disconnect
    req.on('close', () => {
        logger.info(`🔌 SSE connection closed for client ${clientId}`);
        sseService.removeConnection(clientId);
        res.end();
    });

    // Handle connection errors
    req.on('error', (error) => {
        logger.error(`❌ SSE connection error for client ${clientId}: ${error.message}`);
        sseService.removeConnection(clientId);
        res.end();
    });

    // Keep connection alive (prevent timeout)
    const keepAlive = setInterval(() => {
        try {
            res.write(':keepalive\n\n');
        } catch (error) {
            clearInterval(keepAlive);
        }
    }, 15000); // Send keepalive every 15 seconds

    // Clean up keepalive on close
    res.on('close', () => {
        clearInterval(keepAlive);
    });
});

export default router;
