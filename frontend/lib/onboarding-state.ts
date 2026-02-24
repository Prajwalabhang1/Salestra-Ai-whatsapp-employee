/**
 * Onboarding State Manager
 * Manages persistence of onboarding progress using localStorage
 * Prevents data loss on browser refresh or accidental closure
 */

const STORAGE_KEY = 'salestra_onboarding_draft';
const EXPIRY_DAYS = 7; // Draft expires after 7 days

export interface OnboardingDraft {
    currentStep: number;
    formData: any;
    timestamp: number;
    lastSaved: string; // Human-readable timestamp
}

export const OnboardingState = {
    /**
     * Save current onboarding state
     */
    save(step: number, data: any): void {
        try {
            const draft: OnboardingDraft = {
                currentStep: step,
                formData: data,
                timestamp: Date.now(),
                lastSaved: new Date().toLocaleString()
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
            console.log('[OnboardingState] Saved draft at step', step);
        } catch (error) {
            console.error('[OnboardingState] Failed to save:', error);
        }
    },

    /**
     * Load saved onboarding state
     * Returns null if no draft exists or if expired
     */
    load(): OnboardingDraft | null {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;

            const draft: OnboardingDraft = JSON.parse(stored);

            // Check if draft has expired (7 days)
            const expiryTime = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
            const age = Date.now() - draft.timestamp;

            if (age > expiryTime) {
                console.log('[OnboardingState] Draft expired, clearing');
                this.clear();
                return null;
            }

            console.log('[OnboardingState] Loaded draft from', draft.lastSaved);
            return draft;
        } catch (error) {
            console.error('[OnboardingState] Failed to load:', error);
            return null;
        }
    },

    /**
     * Clear saved state
     */
    clear(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('[OnboardingState] Draft cleared');
        } catch (error) {
            console.error('[OnboardingState] Failed to clear:', error);
        }
    },

    /**
     * Check if a draft exists
     */
    exists(): boolean {
        return !!this.load();
    },

    /**
     * Get time since last save (in minutes)
     */
    getTimeSinceLastSave(): number | null {
        const draft = this.load();
        if (!draft) return null;

        const minutes = Math.floor((Date.now() - draft.timestamp) / 60000);
        return minutes;
    }
};

/**
 * Retry helper for failed API requests
 * Uses exponential backoff strategy
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000,
    context?: string
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries - 1;

            if (isLastAttempt) {
                console.error(`[Retry] All ${maxRetries} attempts failed${context ? ` for ${context}` : ''}:`, error);
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = initialDelay * Math.pow(2, attempt);
            console.warn(`[Retry] Attempt ${attempt + 1} failed${context ? ` for ${context}` : ''}, retrying in ${delay}ms...`);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error('Retry logic failed unexpectedly');
}

export default {
    OnboardingState,
    retryWithBackoff
};
