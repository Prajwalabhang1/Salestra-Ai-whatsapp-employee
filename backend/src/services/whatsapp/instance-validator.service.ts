import { evolutionAPI } from '../whatsapp/evolution.service.js';
import logger from '../../lib/logger.js';

export interface ValidationResult {
    isConnected: boolean;
    state: string;
    reason?: string;
}

/**
 * Service to validate WhatsApp instance connection status
 * before attempting to send messages
 */
export class InstanceValidator {
    /**
     * Validate that an instance is connected and ready to send messages
     */
    async validateConnection(instanceId: string): Promise<ValidationResult> {
        try {
            logger.debug(`[InstanceValidator] Checking ${instanceId}...`);

            const stateResponse = await evolutionAPI.getConnectionState(instanceId);

            // Handle different response structures gracefully
            const state = (stateResponse as any)?.instance?.state || (stateResponse as any)?.state || (typeof stateResponse === 'string' ? stateResponse : undefined);

            // Log obscure responses for debugging
            if (!state) {
                logger.warn(`[InstanceValidator] ⚠️ Received undefined state for ${instanceId}`);
                logger.debug(`[InstanceValidator] Raw Response: ${JSON.stringify(stateResponse)}`);

                // Fallback: If we got a valid response (200 OK) but unknown structure, 
                // we might assume it's connected if we can confirm it exists, 
                // OR force a re-check with 'fetchInstances' which sometimes has better data.
                // For now, fail safe but with better logs.
                return {
                    isConnected: false,
                    state: 'unknown',
                    reason: `Received unknown state format from API`
                };
            }

            if (state !== 'open') {
                logger.warn(`[InstanceValidator] Instance ${instanceId} not connected (state: ${state})`);
                return {
                    isConnected: false,
                    state: state,
                    reason: `Instance in ${state} state, expected 'open'`
                };
            }

            logger.debug(`[InstanceValidator] Instance ${instanceId} is connected`);
            return {
                isConnected: true,
                state: state
            };
        } catch (error: any) {
            logger.error(`[InstanceValidator] Error checking ${instanceId}: ${error.message}`);

            // Detailed logging for 401/403/404
            if (error.response) {
                logger.error(`[InstanceValidator] API Error Data: ${JSON.stringify(error.response.data)}`);
            }

            return {
                isConnected: false,
                state: 'error',
                reason: error.response?.status === 404
                    ? 'Instance not found - may have been deleted'
                    : error.message
            };
        }
    }

    /**
     * Check if instance exists (doesn't validate connection state)
     */
    async instanceExists(instanceId: string): Promise<boolean> {
        try {
            await evolutionAPI.getConnectionState(instanceId);
            return true;
        } catch (error: any) {
            if (error.response?.status === 404) {
                return false;
            }
            // Other errors (network, etc) we assume instance exists
            return true;
        }
    }
}

export const instanceValidator = new InstanceValidator();
export default instanceValidator;
