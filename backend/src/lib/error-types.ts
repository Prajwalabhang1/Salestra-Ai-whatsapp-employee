/**
 * Custom error types for better error classification and handling
 */

export class InstanceNotConnectedError extends Error {
    public instanceId: string;
    public state: string;

    constructor(instanceId: string, state: string) {
        super(`Instance ${instanceId} not connected (state: ${state})`);
        this.name = 'InstanceNotConnectedError';
        this.instanceId = instanceId;
        this.state = state;
    }
}

export class LLMProviderError extends Error {
    public provider: string;
    public originalError: Error;

    constructor(provider: string, originalError: Error) {
        super(`LLM Provider ${provider} failed: ${originalError.message}`);
        this.name = 'LLMProviderError';
        this.provider = provider;
        this.originalError = originalError;
    }
}

export class MessageDeliveryError extends Error {
    public reason: string;
    public statusCode?: number;

    constructor(reason: string, statusCode?: number) {
        super(`Message delivery failed: ${reason}` + (statusCode ? ` (status: ${statusCode})` : ''));
        this.name = 'MessageDeliveryError';
        this.reason = reason;
        this.statusCode = statusCode;
    }
}

export class TenantInactiveError extends Error {
    public tenantId: string;
    public status: string;

    constructor(tenantId: string, status: string) {
        super(`Tenant ${tenantId} is ${status}, cannot process messages`);
        this.name = 'TenantInactiveError';
        this.tenantId = tenantId;
        this.status = status;
    }
}
