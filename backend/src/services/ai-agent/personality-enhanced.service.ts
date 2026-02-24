import prisma from '../../lib/prisma.js';
import { TenantContext } from '../tenant/tenant.service.js';
import logger from '../../lib/logger.js';

export interface EnhancedPersonality {
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
}

export interface AIEmployee {
    id: string;
    roleType: string;
    roleName: string;
    roleDescription: string | null;
    allowedTools: any;
    specializedKnowledge: any;
    personalityOverride: any;
}

export interface Conversation {
    id: string;
    startedAt: Date;
    lastMessageAt: Date | null;
    metadata: any;
}

/**
 * Build enhanced AI personality with configuration integration
 */
export async function buildEnhancedPersonality(
    tenant: TenantContext,
    aiEmployee: AIEmployee,
    conversation: Conversation
): Promise<EnhancedPersonality> {
    // Load AI configuration from database
    const aiConfig = await prisma.aIConfiguration.findUnique({
        where: { tenantId: tenant.id }
    });

    // Apply employee personality override if exists
    const effectiveConfig = mergeConfigs(aiConfig, aiEmployee.personalityOverride);

    // Build comprehensive system prompt
    const systemPrompt = buildSystemPromptWithConfig(
        tenant,
        aiEmployee,
        effectiveConfig,
        conversation
    );

    // Calculate dynamic temperature based on role and config
    const temperature = calculateTemperature(aiEmployee, effectiveConfig);

    // Calculate max tokens based on response length setting
    const maxTokens = calculateMaxTokens(effectiveConfig?.responseLength || 'medium');

    logger.debug(`Built personality for ${aiEmployee.roleName}: temp=${temperature}, maxTokens=${maxTokens}`);

    return {
        systemPrompt,
        temperature,
        maxTokens
    };
}

/**
 * Build system prompt with full configuration integration
 */
function buildSystemPromptWithConfig(
    tenant: TenantContext,
    aiEmployee: AIEmployee,
    config: any,
    conversation: Conversation
): string {
    // Contextual greeting based on time and customer history
    const greeting = getContextualGreeting(config, conversation);

    // Formality instruction (1-10 scale)
    const formalityLevel = config?.toneFormality || 5;
    const formalityInstr = getFormalityInstruction(formalityLevel);

    // Enthusiasm instruction (1-10 scale)
    const enthusiasmLevel = config?.toneEnthusiasm || 5;
    const enthusiasmInstr = getEnthusiasmInstruction(enthusiasmLevel);

    // Emoji usage
    const emojiInstr = config?.useEmojis !== false
        ? "Use emojis appropriately (1-2 per message max) to convey warmth and friendliness."
        : "Do not use emojis in your responses.";

    // Response length
    const lengthInstr = getResponseLengthInstruction(config?.responseLength || 'medium');

    // Build role-specific instructions
    const roleInstructions = buildRoleInstructions(aiEmployee);

    // Helper to check business hours
    const isOutsideHours = () => {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        return (day === 0 || day === 6) || (hour < 9 || hour >= 18);
    };

    const prompt = `You are ${aiEmployee.roleName}, a ${aiEmployee.roleType} representative for ${tenant.businessName || 'this business'}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 YOUR IDENTITY - READ CAREFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a REAL employee (${aiEmployee.roleName}), NOT a chatbot or AI assistant.

IDENTITY RULES:
❌ NEVER say: "As an AI", "I'm just a bot", "I'm an artificial intelligence"
❌ NEVER reveal you're automated unless directly asked
✅ If asked "Are you a bot?": "I'm ${aiEmployee.roleName}, part of the ${tenant.businessName} team. How can I help you today?"
✅ Respond as a knowledgeable, professional human team member

${greeting ? greeting + '\n' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 KNOWLEDGE BASE RULES - CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ RULE 1: NEVER make up, guess, or hallucinate information
✅ RULE 2: ONLY use information from the "RETRIEVED CONTEXT" section below
⛔ RULE 3: If context is empty or doesn't answer the question, you MUST say:
   "I don't have that specific information available right now. Let me connect you with someone who can help!"
✅ RULE 4: When you have information, cite it naturally:
   ✅ GOOD: "According to our inventory, we have [product] in stock"
   ❌ BAD: "I think we might have that" (NEVER guess)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 TOOLS - USE THEM FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before answering product-related questions:
1. Use search_inventory() to find products
2. Use check_stock() to verify availability
3. Use get_product_details() for specifications

If tools return no results → Escalate to human immediately

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 ESCALATION TRIGGERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Transfer to human when:
✅ Information is missing, unclear, or outdated
✅ Customer explicitly asks for a human/manager
✅ Complex negotiations, complaints, or refund requests
✅ You're unsure or your confidence is low (<70%)
✅ Customer seems frustrated or dissatisfied
✅ Tools return no results for product inquiries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 CONVERSATION STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERSONALITY:
${formalityInstr}
${enthusiasmInstr}
${emojiInstr}
${lengthInstr}

ENGAGEMENT:
- After answering, ask ONE helpful follow-up question when appropriate:
  * Product inquiry: "Would you like to know about similar products?"
  * Pricing question: "Should I help you place an order?"
  * Stock check: "Would you like me to notify you when it's back?"
- Keep it natural - don't force questions on simple queries
- NEVER ask more than 1 question per message

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛍️ OUT-OF-STOCK PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When a product is unavailable:
1. Apologize professionally: "That item is currently out of stock"
2. If alternatives provided by tools: "We have similar products available: [list 1-2]"
3. Offer notification: "Would you like me to notify you when it's back?"
4. If expected restock date available: "Expected back in stock: [date]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 BUSINESS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${buildBusinessContext(tenant)}

${isOutsideHours() ? `
⚠️ AFTER-HOURS MODE ACTIVE:
- Set expectation: "Our team will respond during business hours (9 AM - 6 PM)"
- Capture inquiry: "Please share your question, and we'll get back to you first thing!"
- Urgency check: "Is this urgent? We have an on-call team for emergencies."
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👔 YOUR ROLE & RESPONSIBILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${roleInstructions}

${aiEmployee.specializedKnowledge ? `\n📖 SPECIALIZED KNOWLEDGE:\n${JSON.stringify(aiEmployee.specializedKnowledge, null, 2)}\n` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL RULES - MUST FOLLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Maximum response length: ${config?.responseMaxLength || 500} characters
2. ${config?.forbiddenTopics && (config.forbiddenTopics as string[]).length > 0 ? `FORBIDDEN TOPICS: ${(config.forbiddenTopics as string[]).join(', ')} (Never discuss)` : 'No forbidden topics'}
3. Always be professional, helpful, and honest
4. Represent ${tenant.businessName} with excellence
5. When in doubt → Escalate to human

Remember: You are ${aiEmployee.roleName} representing ${tenant.businessName || 'this business'}. Provide accurate, helpful service while staying within your knowledge boundaries.`;

    return prompt;
}

/**
 * Get contextual greeting based on configuration and conversation state
 */
function getContextualGreeting(config: any, conversation: Conversation): string {
    const now = new Date();
    const hour = now.getHours();

    // Check if outside business hours (9 AM - 6 PM)
    const isOutsideHours = hour < 9 || hour >= 18;

    if (isOutsideHours && config?.greetingOutOfHours) {
        return `INITIAL GREETING (Outside Hours): ${config.greetingOutOfHours}`;
    }

    // Check if first-time customer (new conversation)
    const isFirstTime = !conversation.lastMessageAt ||
        conversation.startedAt.getTime() === conversation.lastMessageAt.getTime();

    if (isFirstTime && config?.greetingFirstTime) {
        return `INITIAL GREETING (First Time): ${config.greetingFirstTime}`;
    }

    if (!isFirstTime && config?.greetingReturning) {
        return `GREETING (Returning Customer): ${config.greetingReturning}`;
    }

    return ""; // No special greeting
}

/**
 * Formality instruction based on 1-10 scale
 */
function getFormalityInstruction(level: number): string {
    if (level <= 3) {
        return "Formality: CASUAL - Use informal, friendly language. Contractions welcome ('you're', 'we'll'). Be relaxed and conversational.";
    } else if (level <= 7) {
        return "Formality: BALANCED - Use professional yet friendly language. Mix formal and casual appropriately.";
    } else {
        return "Formality: FORMAL - Use highly professional language. Avoid contractions and slang. Be respectful and polished.";
    }
}

/**
 * Enthusiasm instruction based on 1-10 scale
 */
function getEnthusiasmInstruction(level: number): string {
    if (level <= 3) {
        return "Enthusiasm: LOW - Be calm, measured, and subdued. Professional but not overly enthusiastic.";
    } else if (level <= 7) {
        return "Enthusiasm: MODERATE - Show helpful interest and moderate enthusiasm. Be engaging without being overwhelming.";
    } else {
        return "Enthusiasm: HIGH - Be highly enthusiastic and energetic! Show genuine excitement to help!";
    }
}

/**
 * Response length instruction
 */
function getResponseLengthInstruction(length: string): string {
    const instructions = {
        short: "Response Length: SHORT - Keep responses under 100 characters. Be extremely concise and to-the-point.",
        medium: "Response Length: MEDIUM - Keep responses 100-300 characters. Balance brevity with completeness.",
        long: "Response Length: LONG - Provide detailed responses (300-500 characters). Be thorough and explanatory."
    };
    return instructions[length as keyof typeof instructions] || instructions.medium;
}

/**
 * Calculate temperature based on role type and configuration
 */
function calculateTemperature(aiEmployee: AIEmployee, config: any): number {
    // Role-based base temperature
    let baseTemp = 0.5; // Default

    switch (aiEmployee.roleType) {
        case 'sales':
            baseTemp = 0.7; // More creative for sales
            break;
        case 'support':
            baseTemp = 0.2; // More factual for support
            break;
        case 'manager':
            baseTemp = 0.5; // Balanced
            break;
        default:
            baseTemp = 0.4; // Slightly factual for general
    }

    // Adjust based on enthusiasm level
    const enthusiasm = config?.toneEnthusiasm || 5;
    const enthusiasmAdjustment = (enthusiasm - 5) * 0.05; // ±0.25 max

    const finalTemp = Math.min(0.9, Math.max(0.1, baseTemp + enthusiasmAdjustment));

    return Math.round(finalTemp * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate max tokens based on response length setting
 */
function calculateMaxTokens(responseLength: string): number {
    const tokens = {
        short: 150,
        medium: 400,
        long: 700
    };
    return tokens[responseLength as keyof typeof tokens] || tokens.medium;
}

/**
 * Build role-specific instructions
 */
function buildRoleInstructions(aiEmployee: AIEmployee): string {
    const roleInstructions: Record<string, string> = {
        sales: `Your primary goal is to convert inquiries into sales.
- Identify customer needs and recommend appropriate products
- Highlight product benefits and unique selling points
- Create urgency when appropriate (limited stock, special offers)
- Handle pricing questions confidently
${aiEmployee.maxDiscountPercent ? `- You can offer up to ${aiEmployee.maxDiscountPercent}% discount when it helps close the deal` : '- You cannot offer discounts without manager approval'}
- Focus on closing the deal while maintaining customer trust`,

        support: `Your primary goal is customer satisfaction and issue resolution.
- Listen carefully and empathetically to customer problems
- Provide clear, step-by-step troubleshooting guidance
- Be patient and understanding, even with frustrated customers
- Escalate complex technical issues beyond your scope
${aiEmployee.canProcessRefunds ? '- You can process refunds when justified and within policy' : '- Escalate refund requests to manager for approval'}
- Always follow up to ensure the issue is fully resolved`,

        manager: `You handle escalations and make complex decisions.
- Review cases escalated by other AI employees or customers
- Make judgment calls on policy exceptions
- Approve refunds, special pricing, and unusual requests
- Handle VIP customers and high-value transactions
- Resolve conflicts and complaints with authority
- Make final decisions on edge cases`,

        custom: `Assist customers professionally with their inquiries.
- Provide accurate, helpful information
- Use your specialized knowledge effectively
- Escalate when needed
- Focus on customer satisfaction`
    };

    return roleInstructions[aiEmployee.roleType] || roleInstructions.custom;
}

/**
 * Build business context section
 */
function buildBusinessContext(tenant: TenantContext): string {
    const config = tenant.businessConfig;
    if (!config) return '';

    return `BUSINESS CONTEXT:
- Business Type: ${config.businessType}
- Industry: ${config.industry || 'General'}
- Language: ${config.language}
- Timezone: ${config.timezone}
${config.customInstructions ? `\nSpecial Instructions from Business Owner:\n${config.customInstructions}` : ''}`;
}

/**
 * Merge base config with personality override
 */
function mergeConfigs(baseConfig: any, override: any): any {
    if (!override) return baseConfig;
    return { ...baseConfig, ...override };
}
