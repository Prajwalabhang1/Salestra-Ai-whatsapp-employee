/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping calls to failing services
 */

import logger from './logger.js';
import { isFeatureEnabled } from './secrets.js';

// ============================================
// TYPES & INTERFACES
// ============================================

export enum CircuitState {
    CLOSED = 'CLOSED',      // Normal operation
    OPEN = 'OPEN',          // Failing, reject all calls
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerOptions {
    name: string;                 // Identifier for logging
    failureThreshold: number;     // Failures before opening
    resetTimeout: number;         // ms to wait before half-open
    successThreshold: number;     // Successes in half-open to close
    timeout?: number;             // Optional call timeout (ms)
}

export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailure: Date | null;
    lastSuccess: Date | null;
    totalCalls: number;
    totalFailures: number;
}

// ============================================
// CIRCUIT BREAKER CLASS
// ============================================

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failures: number = 0;
    private successes: number = 0;
    private lastFailure: Date | null = null;
    private lastSuccess: Date | null = null;
    private totalCalls: number = 0;
    private totalFailures: number = 0;
    private resetTimer: NodeJS.Timeout | null = null;

    constructor(private options: CircuitBreakerOptions) {
        logger.debug(`[CircuitBreaker:${options.name}] Initialized with threshold=${options.failureThreshold}, timeout=${options.resetTimeout}ms`);
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
        // Check if circuit breaker is disabled via feature flag
        if (!isFeatureEnabled('ENABLE_CIRCUIT_BREAKER')) {
            return fn();
        }

        this.totalCalls++;

        // If circuit is OPEN, reject immediately or use fallback
        if (this.state === CircuitState.OPEN) {
            logger.warn(`[CircuitBreaker:${this.options.name}] Circuit OPEN - rejecting call`);

            if (fallback) {
                return fallback();
            }

            throw new CircuitBreakerOpenError(
                `Circuit breaker '${this.options.name}' is OPEN`,
                this.getStats()
            );
        }

        // If HALF_OPEN, we're testing - allow limited calls
        if (this.state === CircuitState.HALF_OPEN) {
            logger.info(`[CircuitBreaker:${this.options.name}] Circuit HALF_OPEN - testing call`);
        }

        try {
            // Execute with optional timeout
            const result = this.options.timeout
                ? await this.executeWithTimeout(fn, this.options.timeout)
                : await fn();

            this.onSuccess();
            return result;

        } catch (error) {
            this.onFailure(error);

            // If we have a fallback, use it
            if (fallback) {
                logger.info(`[CircuitBreaker:${this.options.name}] Using fallback after failure`);
                return fallback();
            }

            throw error;
        }
    }

    /**
     * Execute with timeout wrapper
     */
    private executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Circuit breaker timeout after ${timeout}ms`));
            }, timeout);

            fn()
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(err => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    /**
     * Handle successful call
     */
    private onSuccess(): void {
        this.lastSuccess = new Date();
        this.failures = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.successes++;

            // If we've reached success threshold, close the circuit
            if (this.successes >= this.options.successThreshold) {
                this.close();
            }
        }
    }

    /**
     * Handle failed call
     */
    private onFailure(error: any): void {
        this.failures++;
        this.totalFailures++;
        this.lastFailure = new Date();

        logger.warn(`[CircuitBreaker:${this.options.name}] Failure #${this.failures}: ${error.message}`);

        // If we're in HALF_OPEN and fail, go back to OPEN
        if (this.state === CircuitState.HALF_OPEN) {
            this.open();
            return;
        }

        // If failures exceed threshold, open the circuit
        if (this.failures >= this.options.failureThreshold) {
            this.open();
        }
    }

    /**
     * Open the circuit (stop all calls)
     */
    private open(): void {
        if (this.state === CircuitState.OPEN) return;

        this.state = CircuitState.OPEN;
        this.successes = 0;

        logger.error(`[CircuitBreaker:${this.options.name}] Circuit OPENED after ${this.failures} failures`);

        // Schedule transition to half-open
        this.scheduleReset();
    }

    /**
     * Close the circuit (resume normal operation)
     */
    private close(): void {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;

        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }

        logger.info(`[CircuitBreaker:${this.options.name}] Circuit CLOSED - resuming normal operation`);
    }

    /**
     * Schedule transition to half-open state
     */
    private scheduleReset(): void {
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
        }

        this.resetTimer = setTimeout(() => {
            this.state = CircuitState.HALF_OPEN;
            this.successes = 0;
            logger.info(`[CircuitBreaker:${this.options.name}] Circuit HALF_OPEN - testing service recovery`);
        }, this.options.resetTimeout);
    }

    /**
     * Get current circuit breaker statistics
     */
    getStats(): CircuitBreakerStats {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailure: this.lastFailure,
            lastSuccess: this.lastSuccess,
            totalCalls: this.totalCalls,
            totalFailures: this.totalFailures,
        };
    }

    /**
     * Get current state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Force reset (for testing/admin)
     */
    reset(): void {
        this.close();
        this.totalCalls = 0;
        this.totalFailures = 0;
        logger.info(`[CircuitBreaker:${this.options.name}] Force reset`);
    }
}

// ============================================
// CUSTOM ERROR
// ============================================

export class CircuitBreakerOpenError extends Error {
    constructor(
        message: string,
        public stats: CircuitBreakerStats
    ) {
        super(message);
        this.name = 'CircuitBreakerOpenError';
    }
}

// ============================================
// PRE-CONFIGURED CIRCUIT BREAKERS
// ============================================

// LLM Provider circuit breaker (aggressive - AI is critical)
export const llmCircuitBreaker = new CircuitBreaker({
    name: 'LLM',
    failureThreshold: 3,        // Open after 3 failures
    resetTimeout: 30000,        // Try again after 30 seconds
    successThreshold: 2,        // 2 successes to fully close
    timeout: 30000,             // 30s timeout for LLM calls
});

// Evolution API circuit breaker (more lenient - external service)
export const evolutionCircuitBreaker = new CircuitBreaker({
    name: 'EvolutionAPI',
    failureThreshold: 5,        // Open after 5 failures
    resetTimeout: 60000,        // Try again after 60 seconds
    successThreshold: 3,        // 3 successes to fully close
    timeout: 15000,             // 15s timeout
});

// Qdrant circuit breaker (can degrade gracefully)
export const qdrantCircuitBreaker = new CircuitBreaker({
    name: 'Qdrant',
    failureThreshold: 5,        // Open after 5 failures
    resetTimeout: 120000,       // Try again after 2 minutes
    successThreshold: 2,        // 2 successes to fully close
    timeout: 10000,             // 10s timeout
});

// ============================================
// HEALTH CHECK FUNCTION
// ============================================

export function getCircuitBreakerHealth(): Record<string, CircuitBreakerStats> {
    return {
        llm: llmCircuitBreaker.getStats(),
        evolution: evolutionCircuitBreaker.getStats(),
        qdrant: qdrantCircuitBreaker.getStats(),
    };
}

export default CircuitBreaker;
