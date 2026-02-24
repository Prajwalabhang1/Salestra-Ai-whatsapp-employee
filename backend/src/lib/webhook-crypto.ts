import crypto from 'crypto';
import logger from './logger.js';

/**
 * Verify webhook signature using HMAC-SHA256
 * Protects against forged webhook requests
 */
export function verifyWebhookSignature(
    payload: any,
    signature: string | undefined,
    secret: string
): boolean {
    if (!signature) {
        logger.warn('Webhook signature missing');
        return false;
    }

    if (!secret) {
        logger.error('WEBHOOK_SECRET not configured');
        return false;
    }

    try {
        // Generate expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        // Timing-safe comparison to prevent timing attacks
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (signatureBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (error) {
        logger.error(`Webhook signature verification error: ${error}`);
        return false;
    }
}
