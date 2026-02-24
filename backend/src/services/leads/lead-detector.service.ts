import { v4 as uuidv4 } from 'uuid';
import prisma from '../../lib/prisma.js';
import logger from '../../lib/logger.js';

/**
 * Detect buying intent from customer message
 */
export function detectIntent(messageText: string): string | null {
    const message = messageText.toLowerCase();

    const intentPatterns = {
        purchase: ['buy', 'purchase', 'order', 'get', 'need', 'want', 'interested in'],
        pricing: ['price', 'cost', 'how much', 'expensive', 'cheap', 'rate'],
        availability: ['available', 'stock', 'in stock', 'have', 'do you sell'],
        information: ['tell me', 'information', 'details', 'about', 'what is'],
    };

    for (const [intent, keywords] of Object.entries(intentPatterns)) {
        if (keywords.some(keyword => message.includes(keyword))) {
            return intent;
        }
    }

    return null;
}

/**
 * Extract potential lead information
 */
export function extractLeadInfo(messages: any[]): any {
    const info: any = {
        name: null,
        email: null,
        product: null,
    };

    // Simple pattern matching for name, email, product mentions
    messages.forEach(msg => {
        if (msg.sender === 'customer') {
            // Email detection
            const emailMatch = msg.messageText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
            if (emailMatch && !info.email) {
                info.email = emailMatch[0];
            }

            // Name detection (if message starts with "I'm" or "My name is")
            const nameMatch = msg.messageText.match(/(?:i'm|my name is|i am)\s+([a-z\s]+)/i);
            if (nameMatch && !info.name) {
                info.name = nameMatch[1].trim();
            }
        }
    });

    return info;
}

/**
 * Auto-create or update lead
 */
export async function createOrUpdateLead(params: {
    tenantId: string;
    conversationId: string;
    customerPhone: string;
    customerName?: string;
    intent: string;
}) {
    const { tenantId, conversationId, customerPhone, customerName, intent } = params;

    try {
        // Check if lead already exists
        const existingLead = await prisma.$queryRaw<any[]>`
            SELECT * FROM leads 
            WHERE tenant_id = ${tenantId} 
            AND customer_phone = ${customerPhone}
            LIMIT 1
        `;

        if (existingLead && existingLead.length > 0) {
            // Update existing lead
            await prisma.$executeRaw`
                UPDATE leads 
                SET 
                    last_contact = NOW(),
                    interaction_count = interaction_count + 1,
                    status = CASE WHEN status = 'converted' THEN 'converted' ELSE 'contacted' END,
                    updated_at = NOW()
                WHERE id = ${existingLead[0].id}
            `;
            logger.info(`Updated existing lead for ${customerPhone}`);
        } else {
            // Create new lead
            await prisma.$executeRaw`
                INSERT INTO leads (
                    id, tenant_id, conversation_id, customer_phone, customer_name,
                    intent, status, interaction_count, created_at, updated_at
                ) VALUES (
                    ${uuidv4()}, ${tenantId}, ${conversationId}, ${customerPhone},
                    ${customerName || null}, ${intent}, 'new', 1, NOW(), NOW()
                )
            `;
            logger.info(`Created new lead for ${customerPhone} with intent: ${intent}`);
        }

        return true;
    } catch (error) {
        logger.error(`Error creating/updating lead: ${error}`);
        return false;
    }
}

/**
 * Get leads for tenant
 */
export async function getLeadsByTenant(tenantId: string) {
    try {
        const leads = await prisma.$queryRaw<any[]>`
            SELECT * FROM leads 
            WHERE tenant_id = ${tenantId}
            ORDER BY created_at DESC
            LIMIT 100
        `;
        return leads;
    } catch (error) {
        logger.error(`Error fetching leads: ${error}`);
        return [];
    }
}
