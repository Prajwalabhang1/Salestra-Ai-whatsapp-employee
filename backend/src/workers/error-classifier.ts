/**
 * Determine if error is transient and worth retrying
 * @param error - The error object
 * @returns true if error is likely transient and retry may help
 */
function isTransientError(error: any): boolean {
    // Network errors - retryable
    if (error.code === 'ECONNREFUSED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.code === 'ENOTFOUND') return true;
    if (error.code === 'ECONNRESET') return true;

    // HTTP errors - check status
    if (error.response?.status) {
        const status = error.response.status;

        // Rate limiting - retryable with backoff
        if (status === 429) return true;

        // Server errors - may be transient
        if (status >= 500) return true;

        // Client errors (4xx except 429) - NOT retryable
        if (status >= 400 && status < 500) return false;
    }

    // LLM-specific errors
    if (error.message?.includes('timeout')) return true;
    if (error.message?.includes('overloaded')) return true;

    // Validation errors, logic errors - NOT retryable
    if (error.name === 'ValidationError') return false;
    if (error.name === 'TypeError') return false;
    if (error.name === 'PrismaClientKnownRequestError') return false;

    // Unknown errors - be conservative, don't retry to avoid duplicates
    return false;
}
