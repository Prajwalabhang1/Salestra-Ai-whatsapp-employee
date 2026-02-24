import logger from './logger.js';

/**
 * Get and validate JWT secret from environment
 * Throws error if secret is missing or too weak
 */
export function getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        logger.error('JWT_SECRET environment variable is not set');
        throw new Error(
            'JWT_SECRET must be set in environment variables. ' +
            'Generate one with: openssl rand -hex 32'
        );
    }

    if (secret.length < 32) {
        logger.error(`JWT_SECRET is too short: ${secret.length} characters`);
        throw new Error(
            'JWT_SECRET must be at least 32 characters long for security. ' +
            'Current length: ' + secret.length
        );
    }

    logger.info('✅ JWT_SECRET loaded and validated');
    return secret;
}

// Export the validated secret
export const JWT_SECRET = getJWTSecret();
