import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import logger from './lib/logger.js';  // Production-grade Winston logger
import { logAudit } from './lib/logger.js';
import { initializeQdrant } from './lib/qdrant.js';
import prisma from './lib/prisma.js';
import { validateSecrets, getConfigSummary } from './lib/secrets.js';
import { CORS_ORIGINS } from './config/api.config.js';
import { correlationIdMiddleware } from './middleware/correlation-id.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

// Routes
import authRoutes from './api/auth.js';
import webhookRoutes from './api/webhooks.js';
import webhookRoutesV2 from './api/webhooks-v2.js';
import webhookMetaRoutes from './api/webhooks-meta.js';
import webhookHealthRoutes from './api/webhook-health.js';
import dashboardRoutes from './api/dashboard.js';
import conversationRoutes from './api/conversations.js';
import onboardingRoutes from './api/onboarding.js';
import onboardingNewRoutes from './api/onboarding-new.js';
import settingsRoutes from './api/settings.js';
import analyticsRoutes from './api/analytics.js';
import billingRoutes from './api/billing.js';
import businessConfigRoutes from './api/business-config.js';
import trialRoutes from './api/trial.js';
import whatsappRoutes from './api/whatsapp.js';
import sseRoutes from './api/sse.js';
import healthRoutes from './api/health.js';
import aiEmployeeRoutes from './api/ai-employee.js';
import knowledgeRoutes from './api/knowledge.js';
import leadsRoutes from './api/leads.js';
import inventoryRoutes from './api/inventory.js';
import spreadsheetRoutes from './api/spreadsheet.js';
// import googleAuthRoutes from './routes/google-auth.routes.js'; // Temporarily disabled

dotenv.config();

// Global Error Handlers - Catch crashes
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', reason);
});

// ============================================

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());

// CORS - using centralized configuration
app.use(cors({
    origin: CORS_ORIGINS,
    credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Correlation ID for request tracking (BEFORE routes)
app.use(correlationIdMiddleware);

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: 500, // Increased from 100 to 500 to prevent blocking
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Request logging
app.use((req, _res, next) => {
    logger.http(`${req.method} ${req.path}`);
    next();
});

// Strict rate limiting for authentication endpoints (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased limit to prevent blocking during development
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many login attempts. Please try again in 15 minutes.'
    },
    skipSuccessfulRequests: true, // Only count failed attempts
});

const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 registrations per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many registration attempts. Please try again later.'
    },
});

// ============================================
// ROUTES
// ============================================

// Health check - comprehensive
app.use('/health', healthRoutes);

// Mount API Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registrationLimiter);
app.use('/api/auth', authRoutes);
// app.use('/api/auth', googleAuthRoutes); // Temporarily disabled - Google OAuth
app.use('/api/webhooks-v2', webhookRoutesV2); // Optimized webhook (V2)
app.use('/api/webhooks-meta', webhookMetaRoutes); // Official Meta API Webhook
app.use('/api/webhooks', webhookRoutes); // V1 endpoint (Re-enabled for existing instances)
app.use('/api/webhooks', webhookHealthRoutes); // Health monitoring
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/onboarding-new', onboardingNewRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/business-config', businessConfigRoutes);
app.use('/api/trial', trialRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/sse', sseRoutes);
app.use('/api/ai-employee', aiEmployeeRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/spreadsheet', spreadsheetRoutes);
app.use('/api/leads', leadsRoutes);

// 404 handler (unmatched routes)
app.use(notFoundHandler);

// Global error handler (MUST be last)
app.use(errorHandler);

// ============================================
// SERVER INITIALIZATION
// ============================================

async function startServer() {
    try {
        // 🔐 SECURITY: Validate secrets at startup
        logger.info('🔐 Validating application secrets...');
        const secretsValidation = validateSecrets();

        if (!secretsValidation.valid) {
            logger.error('❌ Secrets validation failed! Please check your .env file.');
            secretsValidation.errors.forEach(err => logger.error(`   - ${err}`));

            // In production, fail hard if secrets are invalid
            if (process.env.NODE_ENV === 'production') {
                logger.error('🚨 Exiting due to missing required secrets in production');
                process.exit(1);
            }
            logger.warn('⚠️ Development mode: continuing with warnings');
        } else {
            logger.info('✅ All secrets validated successfully');
        }

        // Log configuration summary (masked secrets)
        logger.debug('Configuration summary:', getConfigSummary());

        // Test database connection
        await prisma.$connect();
        logger.info('✅ Database connected successfully');

        // Initialize Qdrant
        try {
            await initializeQdrant();
            logger.info('✅ Qdrant initialized');
        } catch (error) {
            logger.warn('⚠️  Qdrant not available (optional for basic functionality)');
        }

        // Initialize message worker BEFORE starting HTTP server (CRITICAL FIX)
        let workerStatus = 'unavailable';
        try {
            const { redis } = await import('./lib/redis.js');
            const pingResult = await redis.ping();

            if (pingResult !== 'PONG') {
                throw new Error('Redis ping failed');
            }

            logger.info('✅ Redis connected');

            // Initialize smart cache layer
            const { initializeSmartCache } = await import('./lib/smart-cache.js');
            await initializeSmartCache(redis);
            logger.info('✅ Smart cache initialized');

            // Initialize priority message queue
            const { initializePriorityQueue } = await import('./services/queue/priority-message-queue.js');
            await initializePriorityQueue({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD
            });
            logger.info('✅ Priority message queue initialized');

            // Start message worker (V2 optimized or V1 legacy)
            const useOptimizedPipeline = process.env.ENABLE_OPTIMIZED_PIPELINE === 'true';

            if (useOptimizedPipeline) {
                await import('./workers/message-processor-v2.worker.js');
                logger.info('✅ Optimized message worker (V2) initialized');
            } else {
                await import('./workers/message-processor.worker.js');
                logger.info('✅ Legacy message worker (V1) initialized');
            }

            workerStatus = useOptimizedPipeline ? 'active-v2' : 'active-v1';

            // Start connection monitor (TEMPORARILY DISABLED)
            // const connectionMonitor = await import('./services/monitoring/connection-monitor.js');
            // connectionMonitor.default.start();
            // logger.info('✅ WhatsApp connection monitor started');

            // Start instance cleanup service (TEMPORARILY DISABLED)
            // const { cleanupService } = await import('./services/whatsapp/cleanup.service.js');
            // cleanupService.start(15); // Run cleanup every 15 minutes
            // logger.info('✅ Instance cleanup service started');

            // Start SSE heartbeat service (TEMPORARILY DISABLED)
            // const { sseService } = await import('./services/events/sse.service.js');
            // sseService.startHeartbeat(30000); // Send heartbeat every 30 seconds
            // logger.info('✅ SSE heartbeat service started (30s interval)');


        } catch (error: any) {
            logger.error(`❌ Message worker failed to start: ${error.message}`);
            logger.error(error.stack);
            logger.warn('⚠️  Server will start but AI message processing is DISABLED');
            logger.warn('   Ensure Redis is running: docker-compose ps');
            logger.warn('   Then restart server: npm run dev');
            workerStatus = 'degraded';
        }

        // Store worker status for health checks
        (app as any).workerStatus = workerStatus;

        // Start HTTP server AFTER worker initialization
        app.listen(PORT, () => {
            logger.info(`🚀 Salestra API running on port ${PORT}`);
            logger.info(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`⚙️  Worker Status: ${workerStatus}`);
            logger.info(`❤️  Health check: http://localhost:${PORT}/health`);
            logger.info(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard`);
        });
    } catch (error) {
        logger.error(`❌ Failed to start server: ${error}`);
        logger.error(`Stack trace: ${(error as any).stack}`);
        console.error('FULL ERROR DETAILS:', error);
        process.exit(1);
    }
}

// ============================================
// MESSAGE WORKER
// ============================================

// Worker is now initialized asynchronously in startServer()
// This prevents Redis connection issues from blocking server startup

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

startServer();

