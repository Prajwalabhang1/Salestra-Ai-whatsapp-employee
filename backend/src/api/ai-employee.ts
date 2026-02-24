import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = Router();

// ============================================
// DASHBOARD & OVERVIEW
// ============================================

/**
 * GET /api/ai-employee/dashboard
 * Get AI Employee overview with health metrics and quick stats
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const tenantId = (req as any).userId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get AI configuration and status
        const aiConfig = await prisma.aIConfiguration.findUnique({
            where: { tenantId }
        });

        // Get today's message stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayMessages = await prisma.message.count({
            where: {
                tenantId,
                createdAt: { gte: today }
            }
        });

        // Get recent execution logs for confidence analysis
        const recentLogs = await prisma.executionLog.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
                aiConfidence: true,
                status: true,
                executionTimeMs: true
            }
        });

        // Calculate average confidence
        const validConfidences = recentLogs
            .filter(log => log.aiConfidence !== null)
            .map(log => Number(log.aiConfidence));

        const avgConfidence = validConfidences.length > 0
            ? validConfidences.reduce((sum, conf) => sum + conf, 0) / validConfidences.length
            : 0;

        // Calculate escalation rate
        const escalatedCount = recentLogs.filter(log => log.status === 'escalated').length;
        const escalationRate = recentLogs.length > 0
            ? (escalatedCount / recentLogs.length) * 100
            : 0;

        // Calculate average response time
        const validExecutionTimes: number[] = recentLogs
            .filter(log => log.executionTimeMs !== null)
            .map(log => log.executionTimeMs as number);

        const avgResponseTime = validExecutionTimes.length > 0
            ? validExecutionTimes.reduce((sum, time) => sum + time, 0) / validExecutionTimes.length
            : 0;

        // Get recent activity (last 5 events)
        const recentActivity = await prisma.auditLog.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        // Get active conversations count
        const activeConversations = await prisma.conversation.count({
            where: {
                tenantId,
                status: 'active'
            }
        });

        res.json({
            aiStatus: {
                isEnabled: aiConfig?.isEnabled ?? true,
                maintenanceMode: aiConfig?.maintenanceMode ?? false
            },
            metrics: {
                todayMessages,
                avgConfidence: Math.round(avgConfidence * 100),
                escalationRate: parseFloat(escalationRate.toFixed(1)),
                avgResponseTime: Math.round(avgResponseTime),
                activeConversations
            },
            recentActivity: recentActivity.map(log => ({
                action: log.action,
                entity: log.entity,
                timestamp: log.createdAt
            }))
        });

    } catch (error) {
        logger.error('Error fetching AI dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// ============================================
// AI CONFIGURATION
// ============================================

/**
 * GET /api/ai-employee/config
 * Get AI configuration including enhanced personality settings
 */
router.get('/config', authenticateToken, async (req, res) => {
    try {
        const tenantId = (req as any).userId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get or create AI configuration
        let aiConfig = await prisma.aIConfiguration.findUnique({
            where: { tenantId }
        });

        if (!aiConfig) {
            // Create default configuration
            aiConfig = await prisma.aIConfiguration.create({
                data: {
                    tenantId,
                    toneFormality: 5,
                    toneEnthusiasm: 5,
                    responseLength: 'medium',
                    useEmojis: true,
                    conversationStyle: 'conversational'
                }
            });
        }

        // Also get business config for compatibility
        const businessConfig = await prisma.businessConfig.findUnique({
            where: { tenantId }
        });

        res.json({
            aiConfig,
            businessConfig
        });

    } catch (error) {
        logger.error('Error fetching AI config:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

/**
 * PUT /api/ai-employee/config
 * Update AI configuration
 */
router.put('/config', authenticateToken, async (req, res) => {
    try {
        const tenantId = (req as any).userId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            toneFormality,
            toneEnthusiasm,
            responseLength,
            useEmojis,
            conversationStyle,
            greetingFirstTime,
            greetingReturning,
            greetingOutOfHours,
            forbiddenTopics,
            responseMaxLength,
            autoEndAfter,
            isEnabled,
            maintenanceMode,
            maintenanceMessage
        } = req.body;

        // Get old config for audit log
        const oldConfig = await prisma.aIConfiguration.findUnique({
            where: { tenantId }
        });

        // Update or create configuration
        const aiConfig = await prisma.aIConfiguration.upsert({
            where: { tenantId },
            update: {
                ...(toneFormality !== undefined && { toneFormality }),
                ...(toneEnthusiasm !== undefined && { toneEnthusiasm }),
                ...(responseLength && { responseLength }),
                ...(useEmojis !== undefined && { useEmojis }),
                ...(conversationStyle && { conversationStyle }),
                ...(greetingFirstTime !== undefined && { greetingFirstTime }),
                ...(greetingReturning !== undefined && { greetingReturning }),
                ...(greetingOutOfHours !== undefined && { greetingOutOfHours }),
                ...(forbiddenTopics !== undefined && { forbiddenTopics }),
                ...(responseMaxLength !== undefined && { responseMaxLength }),
                ...(autoEndAfter !== undefined && { autoEndAfter }),
                ...(isEnabled !== undefined && { isEnabled }),
                ...(maintenanceMode !== undefined && { maintenanceMode }),
                ...(maintenanceMessage !== undefined && { maintenanceMessage })
            },
            create: {
                tenantId,
                toneFormality: toneFormality ?? 5,
                toneEnthusiasm: toneEnthusiasm ?? 5,
                responseLength: responseLength ?? 'medium',
                useEmojis: useEmojis ?? true,
                conversationStyle: conversationStyle ?? 'conversational',
                greetingFirstTime,
                greetingReturning,
                greetingOutOfHours,
                forbiddenTopics,
                responseMaxLength: responseMaxLength ?? 500,
                autoEndAfter,
                isEnabled: isEnabled ?? true,
                maintenanceMode: maintenanceMode ?? false,
                maintenanceMessage
            }
        });

        // Log the configuration change
        await prisma.auditLog.create({
            data: {
                tenantId,
                action: 'config_updated',
                entity: 'ai_configuration',
                entityId: aiConfig.id,
                changes: {
                    before: oldConfig,
                    after: aiConfig
                },
                performedBy: (req as any).user?.email || 'unknown'
            }
        });

        res.json({ success: true, config: aiConfig });

    } catch (error) {
        logger.error('Error updating AI config:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// ============================================
// CONTROL ENDPOINTS
// ============================================

/**
 * POST /api/ai-employee/control/enable
 * Enable AI employee
 */
router.post('/control/enable', authenticateToken, async (req, res) => {
    try {
        const tenantId = (req as any).userId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const aiConfig = await prisma.aIConfiguration.upsert({
            where: { tenantId },
            update: { isEnabled: true, maintenanceMode: false },
            create: {
                tenantId,
                isEnabled: true,
                maintenanceMode: false
            }
        });

        // Log action
        await prisma.auditLog.create({
            data: {
                tenantId,
                action: 'ai_enabled',
                entity: 'ai_configuration',
                entityId: aiConfig.id,
                performedBy: (req as any).user?.email || 'unknown'
            }
        });

        res.json({ success: true, isEnabled: true });

    } catch (error) {
        logger.error('Error enabling AI:', error);
        res.status(500).json({ error: 'Failed to enable AI' });
    }
});

/**
 * POST /api/ai-employee/control/disable
 * Disable AI employee
 */
router.post('/control/disable', authenticateToken, async (req, res) => {
    try {
        const tenantId = (req as any).userId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const aiConfig = await prisma.aIConfiguration.upsert({
            where: { tenantId },
            update: { isEnabled: false },
            create: {
                tenantId,
                isEnabled: false
            }
        });

        // Log action
        await prisma.auditLog.create({
            data: {
                tenantId,
                action: 'ai_disabled',
                entity: 'ai_configuration',
                entityId: aiConfig.id,
                performedBy: (req as any).user?.email || 'unknown'
            }
        });

        res.json({ success: true, isEnabled: false });

    } catch (error) {
        logger.error('Error disabling AI:', error);
        res.status(500).json({ error: 'Failed to disable AI' });
    }
});

/**
 * POST /api/ai-employee/config/generate
 * Generate AI configuration based on business description using LLM
 */
router.post('/config/generate', authenticateToken, async (req, res) => {
    try {
        const tenantId = (req as any).userId;
        const { businessName, description, industry } = req.body;

        if (!description) {
            return res.status(400).json({ error: 'Business description is required' });
        }

        // We use the LLM provider service to generate the config
        const { LLMProviderFactory } = await import('../services/ai/llm-provider.service.js');

        // Use OpenAI or best available provider for this intelligence task
        const provider = LLMProviderFactory.create('openai'); // Prefer high intelligence model

        const prompt = `
        As an expert AI Personality Designer, create the PERFECT configuration for an AI employee working for this business:
        
        Business Name: ${businessName}
        Industry: ${industry}
        Description: ${description}

        Determine the optimal values for:
        1. Formality (1-10): 1=Casual/Slang, 10=Official/Legalistic
        2. Enthusiasm (1-10): 1=Calm/Serious, 10=Hypered/Excited
        3. Response Length: 'short' (<100 chars), 'medium' (100-300), 'long' (>300)
        4. Emojis: true/false
        5. Greeting Message (First Time): A welcoming initial message
        6. Custom Instructions: Critical behavioral rules specific to this business

        Return JSON ONLY:
        {
            "toneFormality": number,
            "toneEnthusiasm": number,
            "responseLength": "short" | "medium" | "long",
            "useEmojis": boolean,
            "greetingFirstTime": string,
            "customInstructions": string
        }
        `;

        const response = await provider.chat({
            messages: [
                { role: 'system', content: 'You are a JSON-only configuration generator.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        // Parse the JSON response
        let generatedConfig;
        try {
            //Clean markdown code blocks if present
            const cleanContent = response.content?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
            generatedConfig = JSON.parse(cleanContent);
        } catch (e) {
            logger.warn('Failed to parse LLM config generation, using defaults');
            // Fallback defaults
            generatedConfig = {
                toneFormality: 5,
                toneEnthusiasm: 5,
                responseLength: 'medium',
                useEmojis: true,
                greetingFirstTime: `Welcome to ${businessName}! How can I help you today?`,
                customInstructions: ''
            };
        }

        res.json({ success: true, config: generatedConfig });

    } catch (error) {
        logger.error('Error generating AI config:', error);
        res.status(500).json({ error: 'Failed to generate configuration' });
    }
});

/**
 * POST /api/ai-employee/playground/chat
 * Stateless chat for testing AI configuration without saving
 */
router.post('/playground/chat', authenticateToken, async (req, res) => {
    try {
        const tenantId = (req as any).userId;
        const { message, config, mockContext } = req.body;

        // 1. Get Tenant Context associated with user
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { businessConfig: true }
        });

        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        // 2. Import services dynamically
        const { LLMProviderFactory } = await import('../services/ai/llm-provider.service.js');
        const { buildEnhancedPersonality } = await import('../services/ai-agent/personality-enhanced.service.js');
        const { formatContextForLLM } = await import('../services/rag/retrieval.service.js');

        // 3. Mock the AI Employee and Conversation objects for the personality builder
        const mockStart = new Date();
        const aiEmployee = {
            id: 'playground',
            roleType: 'custom',
            roleName: 'AI Assistant (Preview)',
            roleDescription: 'Preview Mode',
            allowedTools: [],
            specializedKnowledge: null,
            personalityOverride: null
        };

        const conversation = {
            id: 'playground',
            startedAt: mockStart,
            lastMessageAt: mockStart,
            metadata: {}
        };

        // 4. Override tenant config with the temporary playground config
        // Pass the playground config as the "override" to the personality builder
        // The buildEnhancedPersonality function merges (AIConfig + EmployeeOverride). 
        // We will mock the AI Config to be equal to our playground config.

        // We need to manually construct the personality because buildEnhancedPersonality reads from DB.
        // Let's reuse the helper functions from personality-enhanced service if possible, 
        // but since they are not all exported, we might need a modified approach.
        // ACTUALLY: We can just temporarily mock the AIConfig object passed to the builder? 
        // No, the builder fetches from DB.

        // BETTER APPROACH: We'll construct the System Prompt manually here reusing the same logic logic 
        // or refactor the service. For now, let's construct a prompt that mimics the real one closely
        // using the *exact same* logic as the service, but with our in-memory config.

        // Let's use the actual service but passing a MOCKED Prisma client? Too complex.
        // Let's modify the service to accept an optional config override?
        // OR: Just implement a "preview" method in the service.

        // Let's try to fetch the service and see if we can use 'buildSystemPromptWithConfig' but it's not exported.
        // We will just replicate the prompt construction here for the playground. It's safer and decoupled.

        const formLevel = config.toneFormality || 5;
        const enthuLevel = config.toneEnthusiasm || 5;

        const formalityMap = (l: number) => l <= 3 ? "Casual/Slang" : l <= 7 ? "Professional/Friendly" : "Formal/Official";
        const enthusiasmMap = (l: number) => l <= 3 ? "Calm/Reserved" : l <= 7 ? "Helpful/Engaging" : "Excited/Energetic";

        const systemPrompt = `
        You are testing a new personality configuration.
        
        ROLE: AI Assistant for ${tenant.businessName}
        
        CONFIGURATION:
        - Formality: ${formalityMap(formLevel)} (${formLevel}/10)
        - Enthusiasm: ${enthusiasmMap(enthuLevel)} (${enthuLevel}/10)
        - Response Length: ${config.responseLength || 'medium'}
        - Use Emojis: ${config.useEmojis ? 'YES' : 'NO'}
        
        BUSINESS CONTEXT:
        ${config.customInstructions || tenant.businessConfig?.customInstructions || ''}
        
        CONTEXTUAL KNOWLEDGE (Mocked):
        ${mockContext || 'No specific context provided for this test.'}
        
        INSTRUCTIONS:
        Respond to the user as if you were the live AI employee. verify that you are matching the tone and style defined above.
        `;

        // 5. Call LLM
        const providerName = tenant.businessConfig?.llmProvider || 'openai';
        const provider = LLMProviderFactory.create(providerName);

        const response = await provider.chat({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            temperature: (config.toneEnthusiasm || 5) / 10, // Rough map
            max_tokens: 300
        });

        res.json({
            response: response.content || "I'm speechless!",
            usage: response.usage
        });

    } catch (error) {
        logger.error('Playground error:', error);
        res.status(500).json({ error: 'Playground chat failed' });
    }
});

/**
 * GET /api/ai-employee/control/status
 * Get current AI status
 */
router.get('/control/status', authenticateToken, async (req, res) => {
    try {
        const tenantId = (req as any).userId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const aiConfig = await prisma.aIConfiguration.findUnique({
            where: { tenantId }
        });

        res.json({
            isEnabled: aiConfig?.isEnabled ?? true,
            maintenanceMode: aiConfig?.maintenanceMode ?? false,
            maintenanceMessage: aiConfig?.maintenanceMessage
        });

    } catch (error) {
        logger.error('Error fetching AI status:', error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

export default router;
