import prisma from '../../lib/prisma.js';
import { TaskType, TaskClassifier } from './classifier.service.js';
import logger from '../../lib/logger.js';

export interface AIEmployee {
    id: string;
    roleType: string;
    roleName: string;
    roleDescription: string | null;
    isDefault: boolean;
    allowedTools: any;
    specializedKnowledge: any;
    personalityOverride: any;
    maxDiscountPercent?: any;
    canProcessRefunds?: boolean;
}

/**
 * Employee Router Service
 * Routes conversations to appropriate AI employees based on task type
 */
export class EmployeeRouter {
    private classifier = new TaskClassifier();

    /**
     * Route a conversation to the appropriate AI employee
     */
    async routeConversation(
        messageText: string,
        tenantId: string,
        conversationId: string
    ): Promise<AIEmployee> {
        // 1. Classify the task type
        const taskType = await this.classifier.classifyMessage(messageText);
        logger.info(`📋 Task classified as: ${taskType}`);

        // 2. Find best AI employee for this task
        const employee = await this.findEmployeeForTask(tenantId, taskType);
        logger.info(`👤 Assigned to: ${employee.roleName} (${employee.roleType})`);

        // 3. Create assignment record
        await this.createAssignment(conversationId, employee.id, taskType);

        return employee as AIEmployee;
    }

    /**
     * Find best AI employee for the given task type
     */
    private async findEmployeeForTask(
        tenantId: string,
        taskType: TaskType
    ): Promise<any> {
        // Map task types to preferred role types
        const roleMap: Record<TaskType, string> = {
            sales: 'sales',
            support: 'support',
            complaint: 'manager',  // Escalate complaints to manager
            refund: 'manager',     // Escalate refunds to manager
            general: 'support'     // General queries go to support
        };

        const preferredRole = roleMap[taskType];

        // Try to find employee with matching role
        let employee = await prisma.aIEmployee.findFirst({
            where: {
                tenantId,
                roleType: preferredRole,
                isActive: true
            },
            orderBy: { successRate: 'desc' } // Get best performing employee
        });

        // Fallback to default employee if no matching role
        if (!employee) {
            logger.info(`No ${preferredRole} employee found, using default`);
            employee = await prisma.aIEmployee.findFirst({
                where: {
                    tenantId,
                    isDefault: true,
                    isActive: true
                }
            });
        }

        // Last resort: create default employee if none exists
        if (!employee) {
            logger.warn(`No AI employee found for tenant ${tenantId}, creating default`);
            employee = await this.createDefaultEmployee(tenantId);
        }

        return employee;
    }

    /**
     * Create assignment record linking conversation to AI employee
     */
    private async createAssignment(
        conversationId: string,
        aiEmployeeId: string,
        taskType: string
    ): Promise<void> {
        // Check if assignment already exists
        const existing = await prisma.conversationAssignment.findFirst({
            where: { conversationId },
            orderBy: { assignedAt: 'desc' }
        });

        // Only create new assignment if it's a new conversation or different employee
        if (!existing || existing.aiEmployeeId !== aiEmployeeId) {
            await prisma.conversationAssignment.create({
                data: {
                    conversationId,
                    aiEmployeeId,
                    taskType,
                    assignmentReason: `Classified as ${taskType} task`,
                    transferredFrom: existing?.aiEmployeeId || null
                }
            });

            if (existing) {
                logger.info(`📝 Transferred conversation to different employee`);
            } else {
                logger.info(`📝 Created new assignment for ${taskType} task`);
            }
        }
    }

    /**
     * Create a default AI employee for tenant (emergency fallback)
     */
    private async createDefaultEmployee(tenantId: string): Promise<any> {
        logger.info(`🆕 Creating default AI employee for tenant ${tenantId}`);

        return await prisma.aIEmployee.create({
            data: {
                tenantId,
                roleType: 'general',
                roleName: 'AI Assistant',
                roleDescription: 'General purpose customer service assistant',
                isDefault: true,
                isActive: true,
                allowedTools: [
                    'search_inventory',
                    'get_product_details',
                    'check_stock',
                    'escalate_to_human'
                ],
                canProcessRefunds: false
            }
        });
    }
}
