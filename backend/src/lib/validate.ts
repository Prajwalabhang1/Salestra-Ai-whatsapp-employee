/**
 * Input Validation & Sanitization Utilities
 * Production-level security hardening for Salestra
 */

import logger from './logger.js';

// ============================================
// CONSTANTS
// ============================================

const MAX_MESSAGE_LENGTH = 4096;
const MAX_PAYLOAD_SIZE = 50000; // 50KB
const PHONE_REGEX = /^\d{10,15}$/;

// HTML/XSS dangerous patterns
const XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick=, onerror=, etc.
    /<img[^>]+src\s*=\s*["']?javascript:/gi,
];

// SQL injection patterns (basic detection)
const SQL_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi,
    /(--)|(;)|(\/\*)/g,
];

// ============================================
// TEXT SANITIZATION
// ============================================

/**
 * Sanitize message text - removes XSS vectors, trims, validates length
 */
export function sanitizeMessageText(text: string | null | undefined): string {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let sanitized = text.trim();

    // Length check
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
        logger.warn(`Message truncated from ${sanitized.length} to ${MAX_MESSAGE_LENGTH} chars`);
        sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Escape HTML entities (prevent XSS in logs/UI)
    sanitized = escapeHtml(sanitized);

    return sanitized;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
    };

    return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
}

/**
 * Check if text contains potential XSS
 */
export function containsXSS(text: string): boolean {
    return XSS_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if text contains potential SQL injection
 */
export function containsSQLInjection(text: string): boolean {
    // Only flag if multiple SQL keywords present (reduces false positives)
    const matches = SQL_PATTERNS.reduce((count, pattern) => {
        const found = text.match(pattern);
        return count + (found ? found.length : 0);
    }, 0);
    return matches >= 3;
}

// ============================================
// PHONE NUMBER VALIDATION
// ============================================

/**
 * Sanitize and validate phone number
 */
export function sanitizePhoneNumber(phone: string | null | undefined): string | null {
    if (!phone || typeof phone !== 'string') {
        return null;
    }

    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // Validate length (10-15 digits for international)
    if (!PHONE_REGEX.test(digitsOnly)) {
        logger.warn(`Invalid phone number format: ${phone.substring(0, 5)}...`);
        return null;
    }

    return digitsOnly;
}

// ============================================
// WEBHOOK PAYLOAD VALIDATION
// ============================================

export interface WebhookValidationResult {
    isValid: boolean;
    error?: string;
    sanitizedData?: {
        event: string;
        instance: string;
        data: any;
    };
}

/**
 * Validate and sanitize incoming webhook payload
 */
export function validateWebhookPayload(body: any): WebhookValidationResult {
    // Check if body exists
    if (!body || typeof body !== 'object') {
        return { isValid: false, error: 'Invalid payload: not an object' };
    }

    // Check payload size
    const payloadSize = JSON.stringify(body).length;
    if (payloadSize > MAX_PAYLOAD_SIZE) {
        logger.error(`Webhook payload too large: ${payloadSize} bytes (max: ${MAX_PAYLOAD_SIZE})`);
        return { isValid: false, error: 'Payload too large' };
    }

    // Check required fields
    const { event, instance, data } = body;

    if (!event || typeof event !== 'string') {
        return { isValid: false, error: 'Missing or invalid event field' };
    }

    if (!instance || typeof instance !== 'string') {
        return { isValid: false, error: 'Missing or invalid instance field' };
    }

    // Validate event type (whitelist approach)
    const allowedEvents = [
        'messages.upsert',
        'connection.update',
        'qrcode.updated',
        'messages.update',
        'presence.update',
    ];

    if (!allowedEvents.includes(event)) {
        logger.debug(`Ignoring unhandled webhook event: ${event}`);
        // Still valid, just not processed
    }

    // Sanitize instance name
    const sanitizedInstance = instance.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedInstance !== instance) {
        logger.warn(`Instance name sanitized: ${instance} -> ${sanitizedInstance}`);
    }

    return {
        isValid: true,
        sanitizedData: {
            event,
            instance: sanitizedInstance,
            data: sanitizeJsonDeep(data),
        },
    };
}

// ============================================
// JSON DEEP SANITIZATION
// ============================================

/**
 * Deep sanitize JSON object - removes dangerous values
 */
export function sanitizeJsonDeep(obj: any, depth = 0): any {
    // Prevent infinite recursion
    if (depth > 10) {
        logger.warn('JSON sanitization: max depth reached');
        return null;
    }

    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return sanitizeMessageText(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeJsonDeep(item, depth + 1));
    }

    if (typeof obj === 'object') {
        const sanitized: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip prototype pollution attempts
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                logger.warn(`Blocked prototype pollution attempt: ${key}`);
                continue;
            }
            sanitized[key] = sanitizeJsonDeep(value, depth + 1);
        }
        return sanitized;
    }

    return null;
}

// ============================================
// IP ADDRESS EXTRACTION
// ============================================

/**
 * Safely extract client IP from request
 * Handles proxies and prevents spoofing
 */
export function getClientIp(req: any): string {
    // Trust proxy headers only if configured
    const trustProxy = process.env.TRUST_PROXY === 'true';

    if (trustProxy) {
        // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2)
        // The first one is typically the real client
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
            const clientIp = ips[0].trim();
            // Basic validation
            if (isValidIp(clientIp)) {
                return clientIp;
            }
        }

        // Check X-Real-IP (used by some proxies)
        const realIp = req.headers['x-real-ip'];
        if (realIp && isValidIp(realIp)) {
            return realIp;
        }
    }

    // Fallback to socket remote address
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Basic IP address validation
 */
function isValidIp(ip: string): boolean {
    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 (simplified)
    const ipv6Regex = /^[a-fA-F0-9:]+$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// ============================================
// EXPORTS
// ============================================

export default {
    sanitizeMessageText,
    sanitizePhoneNumber,
    validateWebhookPayload,
    sanitizeJsonDeep,
    getClientIp,
    escapeHtml,
    containsXSS,
    containsSQLInjection,
};
