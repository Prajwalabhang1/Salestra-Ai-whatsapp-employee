/**
 * Prometheus Metrics for Production Monitoring
 * Tracks system health, performance, and business metrics
 */

import promClient from 'prom-client';

// Create registry
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// ===== COUNTERS =====

/** Total messages received from WhatsApp */
export const messagesReceived = new promClient.Counter({
    name: 'messages_received_total',
    help: 'Total number of messages received',
    labelNames: ['tenantId', 'direction', 'type'],
    registers: [register]
});

/** Total AI responses generated */
export const aiResponses = new promClient.Counter({
    name: 'ai_responses_total',
    help: 'Total number of AI responses generated',
    labelNames: ['tenantId', 'status', 'model'],
    registers: [register]
});

/** Total errors by type */
export const errors = new promClient.Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'code', 'stage', 'severity'],
    registers: [register]
});

/** Database operations */
export const databaseOperations = new promClient.Counter({
    name: 'database_operations_total',
    help: 'Total database operations',
    labelNames: ['operation', 'table', 'status'],
    registers: [register]
});

/** WhatsApp webhooks received */
export const webhooksReceived = new promClient.Counter({
    name: 'webhooks_received_total',
    help: 'Total webhooks received from Evolution API',
    labelNames: ['event', 'instance'],
    registers: [register]
});

// ===== HISTOGRAMS =====

/** Webhook processing duration */
export const webhookDuration = new promClient.Histogram({
    name: 'webhook_duration_ms',
    help: 'Webhook processing duration in milliseconds',
    labelNames: ['event', 'success'],
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [register]
});

/** AI processing duration */
export const aiProcessingDuration = new promClient.Histogram({
    name: 'ai_processing_duration_ms',
    help: 'AI processing duration in milliseconds',
    labelNames: ['tenantId', 'model', 'provider'],
    buckets: [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000],
    registers: [register]
});

/** Database query duration */
export const databaseDuration = new promClient.Histogram({
    name: 'database_operation_duration_ms',
    help: 'Database operation duration in milliseconds',
    labelNames: ['operation', 'table'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [register]
});

/** HTTP request duration */
export const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [register]
});

// ===== GAUGES =====

/** Active conversations */
export const activeConversations = new promClient.Gauge({
    name: 'active_conversations',
    help: 'Number of active conversations',
    labelNames: ['tenantId'],
    registers: [register]
});

/** Message queue depth */
export const queueDepth = new promClient.Gauge({
    name: 'message_queue_depth',
    help: 'Current depth of message processing queue',
    registers: [register]
});

/** Worker status (1 = active, 0 = inactive) */
export const workerStatus = new promClient.Gauge({
    name: 'worker_status',
    help: 'Message worker status (1=active, 0=inactive)',
    registers: [register]
});

/** Connected WhatsApp instances */
export const connectedInstances = new promClient.Gauge({
    name: 'whatsapp_instances_connected',
    help: 'Number of connected WhatsApp instances',
    registers: [register]
});

// ===== SUMMARY =====

/** End-to-end message processing time */
export const messageProcessingTime = new promClient.Summary({
    name: 'message_processing_time_ms',
    help: 'End-to-end message processing time (webhook to response)',
    labelNames: ['tenantId'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
    registers: [register]
});

// ===== HELPER FUNCTIONS =====

/**
 * Track metric with error handling
 */
export function trackMetric(metricFn: () => void, metricName: string) {
    try {
        metricFn();
    } catch (error) {
        console.error(`Failed to track metric ${metricName}:`, error);
    }
}

/**
 * Track message received
 */
export function trackMessageReceived(tenantId: string, direction: 'inbound' | 'outbound', type: string = 'text') {
    trackMetric(
        () => messagesReceived.inc({ tenantId, direction, type }),
        'messagesReceived'
    );
}

/**
 * Track AI response
 */
export function trackAIResponse(tenantId: string, status: 'success' | 'failure', model: string) {
    trackMetric(
        () => aiResponses.inc({ tenantId, status, model }),
        'aiResponses'
    );
}

/**
 * Track error
 */
export function trackError(type: string, code: string, stage: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    trackMetric(
        () => errors.inc({ type, code, stage, severity }),
        'errors'
    );
}

/**
 * Track webhook processing
 */
export function trackWebhook(event: string, instance: string, durationMs: number, success: boolean) {
    trackMetric(() => {
        webhooksReceived.inc({ event, instance });
        webhookDuration.observe({ event, success: success.toString() }, durationMs);
    }, 'webhook');
}

/**
 * Track database operation
 */
export function trackDatabaseOperation(operation: string, table: string, durationMs: number, success: boolean) {
    trackMetric(() => {
        databaseOperations.inc({ operation, table, status: success ? 'success' : 'failure' });
        databaseDuration.observe({ operation, table }, durationMs);
    }, 'database');
}

/**
 * Get metrics as Prometheus format
 */
export async function getMetrics(): Promise<string> {
    return register.metrics();
}

/**
 * Get metrics as JSON (for debugging)
 */
export async function getMetricsJSON() {
    const metrics = await register.getMetricsAsJSON();
    return metrics;
}
