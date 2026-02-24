/**
 * Database Operation Wrapper with Retry Logic and Monitoring
 * Provides resilient database operations with automatic retry, logging, and metrics
 */

import { DatabaseError } from './errors.js';
import { logger } from './logger-v2.js';
import { trackDatabaseOperation } from './metrics.js';

export interface DbOperationOptions {
    retries?: number;
    retryDelay?: number;  // milliseconds
    timeout?: number;     // milliseconds
    operation: string;    // e.g., 'message.create', 'conversation.update'
    table?: string;       // e.g., 'messages', 'conversations'
    correlationId?: string;
    tenantId?: string;
}

/**
 * Execute database operation with retry logic and comprehensive logging
 */
export async function safeDbOperation<T>(
    operation: () => Promise<T>,
    options: DbOperationOptions
): Promise<T> {
    const {
        retries = 3,
        retryDelay = 1000,
        timeout = 30000,
        operation: opName,
        table = 'unknown',
        correlationId,
        tenantId
    } = options;

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.debug('Database operation starting', {
                operation: opName,
                table,
                attempt,
                maxRetries: retries,
                correlationId,
                tenantId
            });

            // Execute with timeout
            const result = await Promise.race([
                operation(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Operation timeout')), timeout)
                )
            ]);

            const duration = Date.now() - startTime;

            // Track success metrics
            trackDatabaseOperation(opName, table, duration, true);

            logger.info('Database operation successful', {
                operation: opName,
                table,
                attempt,
                duration,
                correlationId,
                tenantId
            });

            return result;

        } catch (error: any) {
            lastError = error;
            const isLastAttempt = attempt === retries;
            const duration = Date.now() - startTime;

            logger.error('Database operation failed', {
                operation: opName,
                table,
                attempt,
                maxRetries: retries,
                duration,
                error: {
                    message: error.message,
                    code: error.code,
                    name: error.name
                },
                willRetry: !isLastAttempt,
                correlationId,
                tenantId
            });

            if (isLastAttempt) {
                // Track failure metrics
                trackDatabaseOperation(opName, table, duration, false);

                throw new DatabaseError(
                    `Database operation '${opName}' failed after ${retries} attempts: ${error.message}`,
                    {
                        operation: opName,
                        table,
                        attempts: retries,
                        originalError: error.message,
                        errorCode: error.code,
                        correlationId,
                        tenantId
                    }
                );
            }

            // Exponential backoff
            const delay = retryDelay * attempt;
            logger.debug(`Retrying in ${delay}ms...`, {
                operation: opName,
                attempt,
                correlationId
            });

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Unexpected error in safeDbOperation');
}

/**
 * Batch operation wrapper
 */
export async function safeBatchDbOperation<T>(
    operations: Array<() => Promise<T>>,
    options: Omit<DbOperationOptions, 'operation'> & { operation: string }
): Promise<T[]> {
    const startTime = Date.now();

    try {
        logger.info('Batch database operation starting', {
            operation: options.operation,
            count: operations.length,
            correlationId: options.correlationId
        });

        const results = await Promise.all(
            operations.map((op, index) =>
                safeDbOperation(op, {
                    ...options,
                    operation: `${options.operation}[${index}]`
                })
            )
        );

        const duration = Date.now() - startTime;

        logger.info('Batch database operation successful', {
            operation: options.operation,
            count: operations.length,
            duration,
            correlationId: options.correlationId
        });

        return results;

    } catch (error: any) {
        const duration = Date.now() - startTime;

        logger.error('Batch database operation failed', {
            operation: options.operation,
            count: operations.length,
            duration,
            error: {
                message: error.message,
                code: error.code
            },
            correlationId: options.correlationId
        });

        throw error;
    }
}

/**
 * Transaction wrapper with retry
 */
export async function safeTransaction<T>(
    transactionFn: () => Promise<T>,
    options: DbOperationOptions
): Promise<T> {
    return safeDbOperation(transactionFn, {
        ...options,
        operation: `transaction.${options.operation}`,
        retries: 2  // Fewer retries for transactions
    });
}
