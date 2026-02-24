import prisma from '../../lib/prisma.js';
import logger from '../../lib/logger.js';

export interface ValidationResult {
    isValid: boolean;
    issues: string[];
    requiresApproval: boolean;
    confidence: number;
}

export interface AIEmployee {
    id: string;
    roleType: string;
    approvalRequiredAboveAmount: any;
    canProcessRefunds: boolean;
}

/**
 * Response Validation Service
 * Validates AI-generated responses for safety, compliance, and quality
 */
export class ResponseValidator {
    /**
     * Validate an AI-generated response before sending to customer
     */
    async validateResponse(
        response: string,
        aiConfig: any,
        aiEmployee: AIEmployee,
        tenantId: string,
        conversationId: string
    ): Promise<ValidationResult> {
        const issues: string[] = [];

        // 1. Check response length
        if (aiConfig?.responseMaxLength && response.length > aiConfig.responseMaxLength) {
            issues.push(`Response exceeds max length: ${response.length} > ${aiConfig.responseMaxLength} characters`);
            logger.warn(`Response too long: ${response.length}/${aiConfig.responseMaxLength}`);
        }

        // 2. Check forbidden topics
        if (aiConfig?.forbiddenTopics && Array.isArray(aiConfig.forbiddenTopics)) {
            const forbidden = this.checkForbiddenTopics(response, aiConfig.forbiddenTopics);
            if (forbidden.length > 0) {
                issues.push(`Forbidden topics detected: ${forbidden.join(', ')}`);
                logger.warn(`Forbidden topics in response: ${forbidden.join(', ')}`);
            }
        }

        // 3. Check for sensitive information
        if (this.containsSensitiveData(response)) {
            issues.push('Potentially sensitive information detected (credit card, SSN, etc.)');
            logger.warn('Sensitive data detected in response');
        }

        // 4. Check for inappropriate language
        if (this.containsInappropriateLanguage(response)) {
            issues.push('Inappropriate or unprofessional language detected');
            logger.warn('Inappropriate language detected');
        }

        // 5. Check pricing approval threshold
        const requiresPricingApproval = this.checkPricingApproval(
            response,
            aiEmployee.approvalRequiredAboveAmount
        );

        if (requiresPricingApproval) {
            issues.push('Pricing above approval threshold - requires manager approval');
            logger.info('Pricing approval required');
        }

        const isValid = issues.length === 0;
        const requiresApproval = this.determineApprovalRequired(issues, aiEmployee);
        const confidence = this.calculateValidationConfidence(issues);

        // Log validation result
        await this.logValidation(
            tenantId,
            conversationId,
            response,
            isValid,
            issues,
            requiresApproval
        );

        if (!isValid) {
            logger.info(`Validation failed with ${issues.length} issues`);
        }

        return {
            isValid,
            issues,
            requiresApproval,
            confidence
        };
    }

    /**
     * Check for forbidden topics in response
     */
    private checkForbiddenTopics(response: string, forbiddenTopics: string[]): string[] {
        const lower = response.toLowerCase();
        return forbiddenTopics.filter(topic =>
            lower.includes(topic.toLowerCase())
        );
    }

    /**
     * Check for sensitive data (credit cards, SSN, etc.)
     */
    private containsSensitiveData(response: string): boolean {
        // Credit card pattern (basic)
        const ccPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;

        // SSN pattern
        const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;

        // Email addresses (might be customer's personal email)
        // const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

        return ccPattern.test(response) || ssnPattern.test(response);
    }

    /**
     * Check for inappropriate language
     */
    private containsInappropriateLanguage(response: string): boolean {
        const inappropriateWords = [
            'damn', 'shit', 'fuck', 'bastard', 'ass', 'hell',
            'crap', 'piss', 'dick', 'pussy', 'cock'
        ];

        const lower = response.toLowerCase();
        return inappropriateWords.some(word => {
            // Match whole words only (not substrings)
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(lower);
        });
    }

    /**
     * Check if pricing mentioned requires approval
     */
    private checkPricingApproval(
        response: string,
        threshold: any
    ): boolean {
        if (!threshold) return false;

        // Extract numbers that look like prices
        const pricePatterns = [
            /₹\s*[\d,]+/gi,          // ₹5000 or ₹5,000
            /INR\s*[\d,]+/gi,        // INR 5000
            /\$\s*[\d,]+/gi,         // $500
            /USD\s*[\d,]+/gi,        // USD 500
            /Rs\.?\s*[\d,]+/gi       // Rs 5000 or Rs. 5000
        ];

        let maxPrice = 0;

        for (const pattern of pricePatterns) {
            const matches = response.match(pattern);
            if (matches) {
                for (const match of matches) {
                    const num = match.replace(/[₹,$INRUSDRs.\s,]/g, '');
                    const price = parseFloat(num) || 0;
                    if (price > maxPrice) maxPrice = price;
                }
            }
        }

        const thresholdNum = Number(threshold);
        const requiresApproval = maxPrice > thresholdNum;

        if (requiresApproval) {
            logger.info(`Pricing ${maxPrice} exceeds threshold ${thresholdNum}`);
        }

        return requiresApproval;
    }

    /**
     * Determine if response requires human approval
     */
    private determineApprovalRequired(issues: string[], aiEmployee: AIEmployee): boolean {
        // Critical issues always require approval
        const criticalIssues = issues.filter(i =>
            i.includes('Forbidden') ||
            i.includes('sensitive') ||
            i.includes('Inappropriate')
        );

        if (criticalIssues.length > 0) return true;

        // Pricing above threshold requires approval
        if (issues.some(i => i.includes('Pricing above'))) return true;

        return false;
    }

    /**
     * Calculate validation confidence score
     */
    private calculateValidationConfidence(issues: string[]): number {
        // Start at 100% confidence
        let confidence = 1.0;

        // Deduct for each issue
        const criticalIssueWeight = 0.3;
        const normalIssueWeight = 0.15;

        for (const issue of issues) {
            const isCritical = issue.includes('Forbidden') ||
                issue.includes('sensitive') ||
                issue.includes('Inappropriate');

            confidence -= isCritical ? criticalIssueWeight : normalIssueWeight;
        }

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Log validation result to database
     */
    private async logValidation(
        tenantId: string,
        conversationId: string,
        response: string,
        isValid: boolean,
        issues: string[],
        requiresApproval: boolean
    ): Promise<void> {
        try {
            await prisma.responseValidation.create({
                data: {
                    tenantId,
                    conversationId,
                    generatedResponse: response,
                    validationStatus: isValid ? 'passed' : requiresApproval ? 'needs_approval' : 'failed',
                    issues: issues.length > 0 ? issues : null,
                    requiresApproval
                }
            });
        } catch (error) {
            logger.error(`Failed to log validation: ${error}`);
            // Don't throw - validation logging shouldn't break the flow
        }
    }
}
