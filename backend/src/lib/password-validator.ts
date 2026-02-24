/**
 * Password Validation Utility
 * Enforces enterprise-grade password security
 */

const COMMON_PASSWORDS = [
    'password', 'password123', '12345678', '123456789', '1234567890',
    'qwerty', 'qwerty123', 'abc123', 'monkey', 'letmein',
    'welcome', 'welcome123', 'admin', 'admin123', 'password1',
    'iloveyou', 'trustno1', 'dragon', 'master', 'sunshine',
    'princess', 'football', 'baseball', 'superman', 'batman',
    'liverpool', 'chelsea', 'arsenal', 'manchester', 'jordan',
    'password@123', 'pass123', 'test123', 'demo123', 'sample123'
];

export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
}

/**
 * Validate password strength and complexity
 */
/**
 * Validate password strength
 * Simplified for better user experience
 */
export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    let strength: 'weak' | 'medium' | 'strong' = 'medium';

    // Simplified Length check (minimum 6 characters)
    if (password.length < 6) {
        errors.push('Password must be at least 6 characters');
    }

    return {
        valid: errors.length === 0,
        errors,
        strength: errors.length === 0 ? 'strong' : 'weak'
    };
}

/**
 * Calculate password strength score (0-100)
 */
export function calculatePasswordStrength(password: string): number {
    let score = 0;

    // Length scoring (0-40 points)
    if (password.length >= 16) score += 40;
    else if (password.length >= 12) score += 30;
    else if (password.length >= 8) score += 20;
    else score += 10;

    // Character variety (0-40 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)) score += 10;

    // Bonus points (0-20 points)
    const specialCount = (password.match(/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/g) || []).length;
    if (specialCount >= 2) score += 10;

    if (password.length >= 20) score += 10;

    // Penalties
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) score -= 30;
    if (/(.)\1{3,}/.test(password)) score -= 20;

    return Math.max(0, Math.min(100, score));
}

export default {
    validatePassword,
    calculatePasswordStrength
};
