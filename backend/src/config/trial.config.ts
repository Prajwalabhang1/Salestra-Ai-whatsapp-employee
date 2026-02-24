/**
 * Trial Configuration
 * Centralized settings for trial usage limits and duration
 */

export const TRIAL_CONFIG = {
    // Duration in days
    DURATION_DAYS: parseInt(process.env.TRIAL_DAYS || '7'),

    // Message limits during trial
    MESSAGE_LIMIT: parseInt(process.env.TRIAL_MESSAGE_LIMIT || '1000'),

    // Feature flags
    FEATURES: {
        AI_EMPLOYEE: true,
        KNOWLEDGE_BASE: true,
        WHATSAPP_CONNECTION: true,
        ANALYTICS: true,
        API_ACCESS: false, // Premium only
        CUSTOM_BRANDING: false // Premium only
    },

    // Marketing copy helpers
    getTrialEndMessage: (daysLeft: number) => {
        if (daysLeft <= 0) return 'Your trial has ended. Upgrade to continue.';
        if (daysLeft === 1) return 'Your trial ends tomorrow!';
        return `You have ${daysLeft} days left in your free trial.`;
    }
};
