/**
 * Analytics Utility
 * Wrapper for Google Analytics and internal tracking
 */

type EventName =
    | 'onboarding_start'
    | 'onboarding_step_complete'
    | 'onboarding_step_view'
    | 'onboarding_complete'
    | 'signup_complete'
    | 'email_verified'
    | 'knowledge_upload'
    | 'knowledge_upload_complete'
    | 'knowledge_text_added'
    | 'whatsapp_connected'
    | 'error_occurred';

interface AnalyticsEvent {
    name: EventName;
    properties?: Record<string, any>;
}

class Analytics {
    private initialized = false;
    private startTime: number = Date.now();
    private stepStartTime: number = Date.now();

    init(measurementId?: string) {
        if (typeof window === 'undefined') return;
        if (this.initialized) return;

        // Initialize GA4 if ID provided
        if (measurementId) {
            const script = document.createElement('script');
            script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
            script.async = true;
            document.head.appendChild(script);

            window.dataLayer = window.dataLayer || [];
            function gtag(...args: any[]) {
                window.dataLayer.push(args);
            }
            gtag('js', new Date());
            gtag('config', measurementId);

            this.initialized = true;
            console.log('[Analytics] Initialized with ID:', measurementId);
        } else {
            console.log('[Analytics] Running in dev mode (no ID)');
        }
    }

    track(name: EventName, properties?: Record<string, any>) {
        const timestamp = new Date().toISOString();
        const eventData = {
            ...properties,
            timestamp,
            url: typeof window !== 'undefined' ? window.location.pathname : '',
            userId: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').id : undefined
        };

        // Log to console in dev
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Analytics] 📊 ${name}:`, eventData);
        }

        // Send to GA4
        if (this.initialized && typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', name, eventData);
        }

        // Optional: Send to backend for custom tracking
        // this.sendToBackend(name, eventData);
    }

    trackStepComplete(stepName: string, stepIndex: number) {
        const duration = Math.round((Date.now() - this.stepStartTime) / 1000);
        this.track('onboarding_step_complete', {
            step: stepName,
            stepIndex,
            durationSeconds: duration
        });
        this.stepStartTime = Date.now(); // Reset for next step
    }

    trackError(message: string, context?: string) {
        this.track('error_occurred', {
            message,
            context,
            path: typeof window !== 'undefined' ? window.location.pathname : ''
        });
    }

    // Helper to get total time spent so far
    getTotalDuration() {
        return Math.round((Date.now() - this.startTime) / 1000);
    }
}

// Export singleton
export const analytics = new Analytics();

// Window type extension
declare global {
    interface Window {
        dataLayer: any[];
    }
}
