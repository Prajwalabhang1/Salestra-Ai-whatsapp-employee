/**
 * Secrets Management Utility
 * Centralized access to environment secrets with validation
 */

import logger from './logger.js';

// ============================================
// SECRET DEFINITIONS
// ============================================

interface SecretConfig {
    name: string;
    required: boolean;
    defaultValue?: string;
    mask?: boolean;  // Whether to mask in logs (default: true for secrets)
}

const SECRET_DEFINITIONS: SecretConfig[] = [
    // Database
    { name: 'DATABASE_URL', required: true, mask: true },

    // Redis
    { name: 'REDIS_URL', required: false, defaultValue: 'redis://localhost:6379', mask: false },

    // JWT
    { name: 'JWT_SECRET', required: true, mask: true },

    // Evolution API
    { name: 'EVOLUTION_API_URL', required: false, defaultValue: 'http://localhost:8080', mask: false },
    { name: 'EVOLUTION_API_KEY', required: true, mask: true },

    // Webhook Security
    { name: 'WEBHOOK_SECRET', required: false, mask: true },  // Required in production

    // LLM Providers (at least one required)
    { name: 'OPENAI_API_KEY', required: false, mask: true },
    { name: 'GROQ_API_KEY', required: false, mask: true },
    { name: 'OLLAMA_HOST', required: false, defaultValue: 'http://localhost:11434', mask: false },

    // Application
    { name: 'NODE_ENV', required: false, defaultValue: 'development', mask: false },
    { name: 'PORT', required: false, defaultValue: '3000', mask: false },
    { name: 'FRONTEND_URL', required: false, defaultValue: 'http://localhost:3001', mask: false },
    { name: 'BACKEND_URL', required: false, defaultValue: 'http://localhost:3000', mask: false },

    // Feature Flags
    { name: 'ENABLE_CIRCUIT_BREAKER', required: false, defaultValue: 'true', mask: false },
    { name: 'ENABLE_DLQ', required: false, defaultValue: 'true', mask: false },
    { name: 'ENABLE_CACHING', required: false, defaultValue: 'true', mask: false },
    { name: 'ENABLE_METRICS', required: false, defaultValue: 'true', mask: false },
    { name: 'ENABLE_LLM_FALLBACK', required: false, defaultValue: 'true', mask: false },

    // Proxy Settings
    { name: 'TRUST_PROXY', required: false, defaultValue: 'false', mask: false },
];

// ============================================
// SECRETS CACHE
// ============================================

const secretsCache: Map<string, string> = new Map();
let validated = false;

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Get a secret value
 */
export function getSecret(name: string): string | undefined {
    // Check cache first
    if (secretsCache.has(name)) {
        return secretsCache.get(name);
    }

    // Get from environment
    const value = process.env[name];

    // Find config for this secret
    const config = SECRET_DEFINITIONS.find(s => s.name === name);

    // Apply default if available
    if (!value && config?.defaultValue) {
        secretsCache.set(name, config.defaultValue);
        return config.defaultValue;
    }

    if (value) {
        secretsCache.set(name, value);
    }

    return value;
}

/**
 * Get a required secret (throws if missing)
 */
export function getRequiredSecret(name: string): string {
    const value = getSecret(name);
    if (!value) {
        throw new Error(`Required secret '${name}' is not configured`);
    }
    return value;
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagName: string): boolean {
    const value = getSecret(flagName);
    return value === 'true' || value === '1';
}

/**
 * Mask a secret for safe logging
 */
export function maskSecret(value: string | undefined): string {
    if (!value) return '[not set]';
    if (value.length <= 8) return '****';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

/**
 * Validate all required secrets at startup
 */
export function validateSecrets(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const isProduction = process.env.NODE_ENV === 'production';

    logger.info('🔐 Validating application secrets...');

    for (const config of SECRET_DEFINITIONS) {
        const value = process.env[config.name];

        // Check required secrets
        if (config.required && !value) {
            errors.push(`Missing required secret: ${config.name}`);
            continue;
        }

        // Production-specific checks
        if (isProduction) {
            // Webhook secret is required in production
            if (config.name === 'WEBHOOK_SECRET' && !value) {
                errors.push('WEBHOOK_SECRET is required in production');
            }

            // JWT secret should be strong in production
            if (config.name === 'JWT_SECRET' && value && value.length < 32) {
                errors.push('JWT_SECRET should be at least 32 characters in production');
            }
        }

        // Log secret status (masked)
        if (value) {
            const displayValue = config.mask !== false ? maskSecret(value) : value;
            logger.debug(`  ✅ ${config.name}: ${displayValue}`);
        } else if (config.defaultValue) {
            logger.debug(`  ⚠️ ${config.name}: using default`);
        } else {
            logger.debug(`  ➖ ${config.name}: not set`);
        }
    }

    // Check that at least one LLM provider is configured
    const hasLLMProvider =
        process.env.OPENAI_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.OLLAMA_HOST;

    if (!hasLLMProvider) {
        errors.push('At least one LLM provider must be configured (OPENAI_API_KEY, GROQ_API_KEY, or OLLAMA_HOST)');
    }

    validated = true;

    if (errors.length > 0) {
        logger.error('❌ Secret validation failed:');
        errors.forEach(err => logger.error(`   - ${err}`));
        return { valid: false, errors };
    }

    logger.info('✅ All secrets validated successfully');
    return { valid: true, errors: [] };
}

/**
 * Get startup configuration summary (safe to log)
 */
export function getConfigSummary(): Record<string, string> {
    const summary: Record<string, string> = {};

    for (const config of SECRET_DEFINITIONS) {
        const value = getSecret(config.name);
        if (config.mask !== false) {
            summary[config.name] = maskSecret(value);
        } else {
            summary[config.name] = value || config.defaultValue || '[not set]';
        }
    }

    return summary;
}

/**
 * Check if secrets have been validated
 */
export function isValidated(): boolean {
    return validated;
}

// ============================================
// EXPORTS
// ============================================

export default {
    getSecret,
    getRequiredSecret,
    isFeatureEnabled,
    maskSecret,
    validateSecrets,
    getConfigSummary,
    isValidated,
};
