/**
 * Validation Utilities
 * Input validation for onboarding and user data
 */

export interface ValidationResult {
    valid: boolean;
    error?: string;
    formatted?: string;
}

/**
 * Validate WhatsApp number format
 * Accepts international format with country code
 */
export function validateWhatsAppNumber(number: string): ValidationResult {
    // Remove all non-digits
    const clean = number.replace(/\D/g, '');

    // Basic length check (10-15 digits including country code)
    if (clean.length < 10 || clean.length > 15) {
        return {
            valid: false,
            error: 'WhatsApp number must be 10-15 digits including country code'
        };
    }

    // Must NOT start with 0 (needs country code)
    if (clean[0] === '0') {
        return {
            valid: false,
            error: 'Please include country code (e.g., 91 for India). Don\'t start with 0.'
        };
    }

    // Common country codes (top 50 countries)
    const validCountryCodes = [
        '1',   // USA, Canada
        '7',   // Russia, Kazakhstan
        '20',  // Egypt
        '27',  // South Africa
        '30',  // Greece
        '31',  // Netherlands
        '32',  // Belgium
        '33',  // France
        '34',  // Spain
        '39',  // Italy
        '40',  // Romania
        '41',  // Switzerland
        '44',  // UK
        '45',  // Denmark
        '46',  // Sweden
        '47',  // Norway
        '48',  // Poland
        '49',  // Germany
        '51',  // Peru
        '52',  // Mexico
        '53',  // Cuba
        '54',  // Argentina
        '55',  // Brazil
        '56',  // Chile
        '57',  // Colombia
        '58',  // Venezuela
        '60',  // Malaysia
        '61',  // Australia
        '62',  // Indonesia
        '63',  // Philippines
        '64',  // New Zealand
        '65',  // Singapore
        '66',  // Thailand
        '81',  // Japan
        '82',  // South Korea
        '84',  // Vietnam
        '86',  // China
        '90',  // Turkey
        '91',  // India
        '92',  // Pakistan
        '93',  // Afghanistan
        '94',  // Sri Lanka
        '95',  // Myanmar
        '98',  // Iran
        '212', // Morocco
        '213', // Algeria
        '234', // Nigeria
        '254', // Kenya
        '255', // Tanzania
        '260', // Zambia
        '263', // Zimbabwe
        '351', // Portugal
        '352', // Luxembourg
        '353', // Ireland
        '358', // Finland
        '380', // Ukraine
        '420', // Czech Republic
        '971', // UAE
        '972', // Israel
        '973', // Bahrain
        '974', // Qatar
        '966', // Saudi Arabia
    ];

    // Check if number starts with valid country code
    const hasValidPrefix = validCountryCodes.some(code => clean.startsWith(code));

    if (!hasValidPrefix) {
        return {
            valid: false,
            error: 'Invalid country code. Please verify your number format.'
        };
    }

    // All checks passed
    return {
        valid: true,
        formatted: clean
    };
}

/**
 * Validate business name
 */
export function validateBusinessName(name: string): ValidationResult {
    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return {
            valid: false,
            error: 'Business name must be at least 2 characters'
        };
    }

    if (trimmed.length > 100) {
        return {
            valid: false,
            error: 'Business name must be less than 100 characters'
        };
    }

    // Allow letters, numbers, spaces, and common business symbols: & , . ' ( ) -
    const validPattern = /^[a-zA-Z0-9\s&,.'"()\-]+$/;
    if (!validPattern.test(trimmed)) {
        return {
            valid: false,
            error: 'Business name contains invalid characters'
        };
    }

    return {
        valid: true,
        formatted: trimmed
    };
}

/**
 * Validate business description
 */
export function validateBusinessDescription(desc: string): ValidationResult {
    const trimmed = desc.trim();

    if (trimmed.length < 50) {
        return {
            valid: false,
            error: `Please provide at least 50 characters (${trimmed.length}/50). Help the AI understand your business better.`
        };
    }

    if (trimmed.length > 1000) {
        return {
            valid: false,
            error: 'Description is too long (max 1000 characters)'
        };
    }

    // Check if it's just repeated characters (spam detection)
    const uniqueChars = new Set(trimmed.toLowerCase()).size;
    if (uniqueChars < 10) {
        return {
            valid: false,
            error: 'Please provide a meaningful description of your business'
        };
    }

    return {
        valid: true,
        formatted: trimmed
    };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
    const trimmed = email.trim().toLowerCase();

    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return {
            valid: false,
            error: 'Please enter a valid email address'
        };
    }

    // Check for common typos
    const commonTypos: Record<string, string> = {
        'gmial.com': 'gmail.com',
        'gmai.com': 'gmail.com',
        'gmil.com': 'gmail.com',
        'yahooo.com': 'yahoo.com',
        'yaho.com': 'yahoo.com',
        'hotmial.com': 'hotmail.com',
        'outlok.com': 'outlook.com',
    };

    const domain = trimmed.split('@')[1];
    const suggestion = commonTypos[domain];

    if (suggestion) {
        return {
            valid: false,
            error: `Did you mean ${trimmed.split('@')[0]}@${suggestion}?`
        };
    }

    return {
        valid: true,
        formatted: trimmed
    };
}

/**
 * Format phone number for display (adds spaces)
 */
export function formatPhoneDisplay(number: string): string {
    const clean = number.replace(/\D/g, '');

    // For Indian numbers: 91 98765 43210
    if (clean.startsWith('91') && clean.length === 12) {
        return `${clean.slice(0, 2)} ${clean.slice(2, 7)} ${clean.slice(7)}`;
    }

    // For US/Canada: 1 (555) 123-4567
    if (clean.startsWith('1') && clean.length === 11) {
        return `${clean[0]} (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
    }

    // Generic: +XX XXXXX...
    return `+${clean.slice(0, 2)} ${clean.slice(2)}`;
}

export default {
    validateWhatsAppNumber,
    validateBusinessName,
    validateBusinessDescription,
    validateEmail,
    formatPhoneDisplay
};
