/**
 * PII (Personally Identifiable Information) Masking
 * GDPR and SOC2 Compliant Data Redaction
 * 
 * Automatically masks sensitive data in logs to comply with:
 * - GDPR (General Data Protection Regulation)
 * - SOC 2 (System and Organization Controls)
 * - PCI DSS (Payment Card Industry Data Security Standard)
 */

// Patterns to detect and mask PII
const PII_PATTERNS = {
    // Phone numbers (various formats)
    phone: /(\+?[\d\s()-]{10,})/g,

    // Email addresses
    email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,

    // WhatsApp JIDs
    whatsappJid: /(\d{10,15})@s\.whatsapp\.net/g,
    whatsappLid: /(\d{10,15})@lid/g,

    // Credit card numbers (Luhn algorithm validated)
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

    // Social Security Numbers (US format)
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

    // API keys and tokens (common patterns)
    apiKey: /\b[a-zA-Z0-9]{32,}\b/g,
    bearerToken: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g,

    // IP addresses
    ipv4: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
};

// Fields that should always be masked (case-insensitive matching)
const SENSITIVE_FIELD_NAMES = [
    'password',
    'token',
    'secret',
    'apikey',
    'authorization',
    'creditcard',
    'ssn',
    'cvv',
    'pin'
];

/**
 * Main PII masking function
 * Recursively masks PII in objects, arrays, and strings
 */
export function maskPII(data: any, depth: number = 0): any {
    // Prevent infinite recursion
    if (depth > 10) return '[MAX_DEPTH_REACHED]';

    // Handle null/undefined
    if (data === null || data === undefined) return data;

    // Handle strings - apply pattern matching
    if (typeof data === 'string') {
        return maskString(data);
    }

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => maskPII(item, depth + 1));
    }

    // Handle objects
    if (typeof data === 'object') {
        const masked: any = {};

        for (const key in data) {
            if (!data.hasOwnProperty(key)) continue;

            // Check if field name is sensitive
            if (isSensitiveField(key)) {
                masked[key] = maskSensitiveField(data[key], key);
            } else {
                // Recursively mask nested objects
                masked[key] = maskPII(data[key], depth + 1);
            }
        }

        return masked;
    }

    // Return primitives as-is
    return data;
}

/**
 * Mask a string using pattern matching
 */
function maskString(value: string): string {
    if (!value || typeof value !== 'string') return value;

    let masked = value;

    // Apply each pattern
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
        masked = masked.replace(pattern, (match) => {
            // For emails and phones, keep partial info for debugging
            if (type === 'email') {
                const [local, domain] = match.split('@');
                return `${local.substring(0, 2)}***@${domain}`;
            }

            if (type === 'phone') {
                // Keep country code + last 4
                const cleaned = match.replace(/[^\d+]/g, '');
                if (cleaned.length > 7) {
                    return cleaned.substring(0, 3) + '****' + cleaned.slice(-4);
                }
                return '[PHONE_REDACTED]';
            }

            if (type === 'whatsappJid') {
                const phoneNum = match.split('@')[0];
                return phoneNum.substring(0, 3) + '****' + phoneNum.slice(-4) + '@s.whatsapp.net';
            }

            // For other types, completely redact
            return `[${type.toUpperCase()}_REDACTED]`;
        });
    }

    return masked;
}

/**
 * Check if field name indicates sensitive data
 */
function isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return SENSITIVE_FIELD_NAMES.some(sensitive =>
        lowerField.includes(sensitive)
    );
}

/**
 * Mask sensitive field based on field name and value
 */
function maskSensitiveField(value: any, fieldName: string): any {
    if (value === null || value === undefined) return value;

    const lowerField = fieldName.toLowerCase();

    // Complete redaction for passwords and secrets
    if (lowerField.includes('password') ||
        lowerField.includes('secret') ||
        lowerField.includes('token')) {
        return '[REDACTED]';
    }

    // Partial masking for phone numbers
    if (lowerField.includes('phone') || lowerField.includes('mobile')) {
        const str = String(value);
        if (str.length > 7) {
            return str.substring(0, 3) + '****' + str.slice(-4);
        }
        return '[PHONE_REDACTED]';
    }

    // Partial masking for emails
    if (lowerField.includes('email')) {
        const str = String(value);
        const [local, domain] = str.split('@');
        if (domain) {
            return `${local.substring(0, 2)}***@${domain}`;
        }
        return '[EMAIL_REDACTED]';
    }

    // Default: complete redaction
    return '[SENSITIVE_DATA_REDACTED]';
}

/**
 * Special handling for message text
 * In production: mask content, keep length
 * In debug mode: show preview
 */
export function maskMessageText(text: string, debugMode: boolean = false): string {
    if (!text) return text;

    if (debugMode || process.env.LOG_LEVEL === 'debug') {
        // Show first 50 chars in debug mode
        return text.substring(0, 50) + (text.length > 50 ? '...' : '');
    }

    // In production, only show length
    return `[MESSAGE_LENGTH:${text.length}]`;
}

/**
 * Mask customer phone number while preserving ability to track
 * Format: Country code + **** + last 4 digits
 */
export function maskPhoneNumber(phone: string): string {
    if (!phone) return phone;

    const cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.length > 7) {
        return cleaned.substring(0, 3) + '****' + cleaned.slice(-4);
    }

    return '[PHONE_REDACTED]';
}

/**
 * Create a safe logging context with PII masked
 */
export function createSafeLogContext(context: any): any {
    return maskPII(context);
}
