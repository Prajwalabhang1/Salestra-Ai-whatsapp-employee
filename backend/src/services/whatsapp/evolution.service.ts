// Re-export interface for compatibility
export interface WhatsAppMessage {
    number: string;
    text: string;
    delay?: number;
}

export interface WhatsAppInstance {
    instanceName: string;
    status?: string;
    state?: string;  // For connection status responses
    qrcode?: {
        code: string;
        base64: string;
    };
}

import axios, { AxiosInstance } from 'axios';
import logger from '../../lib/logger.js';
import { metaWhatsAppService } from './meta.service.js'; // Import Meta Service
import prisma from '../../lib/prisma.js'; // Import Prisma for lookup

export class EvolutionAPIService {
    private client: AxiosInstance;
    private apiUrl: string;
    private apiKey: string;

    constructor() {
        this.apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        this.apiKey = process.env.EVOLUTION_API_KEY || '';

        // Validate API key is set - FAIL FAST on missing credentials
        if (!this.apiKey) {
            const errorMsg = '🚨 CRITICAL: EVOLUTION_API_KEY environment variable is not set. Please configure it in .env file.';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        // Log masked API key for debugging
        const maskedKey = this.apiKey ? `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'NOT_SET';
        logger.info(`[EvolutionAPI] Initialized with URL: ${this.apiUrl}, API Key: ${maskedKey}`);

        this.client = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.apiKey,
            },
            timeout: 30000,
        });
    }

    /**
     * Helper to check if instance is Meta
     */
    private async isMetaInstance(instanceName: string): Promise<boolean> {
        try {
            const config = await metaWhatsAppService.getConfig(instanceName);
            return !!config;
        } catch {
            return false;
        }
    }

    /**
     * Check if Evolution API is healthy
     */
    async getHealth(): Promise<{ status: string }> {
        // We can check both or just Evolution
        try {
            const response = await this.client.get('/');
            return { status: 'healthy' };
        } catch (error: any) {
            logger.error(`Evolution API is not healthy: ${error.message}`);
            // Check if Meta is at least configured?
            // For now, if Evolution is down, we report it.
            throw new Error('Evolution API is not accessible');
        }
    }

    /**
     * Fetch all instances
     */
    async fetchInstances(): Promise<any[]> {
        try {
            const response = await this.client.get('/instance/fetchInstances');
            return response.data || [];
        } catch (error: any) {
            logger.error(`Failed to fetch instances: ${error.message}`);
            return [];
        }
    }

    /**
     * Create a new WhatsApp instance
     */
    async createInstance(instanceName: string, webhookUrl: string): Promise<WhatsAppInstance> {
        // If the implementation plan says to support parallel, we continue to use Evolution for creation
        // UNLESS the user explicitly wants a Meta instance.
        // But the frontend usually drives this. 
        // For now, we default to Evolution creation to maintain backward compatibility.
        // If we want to create a Meta instance, we'd need a flag or different endpoint.
        // We will keep this as Evolution-only for now, as Meta setup is manual in DB.

        try {
            // Minimal payload that actually works with Evolution API v2
            const response = await this.client.post('/instance/create', {
                instanceName: instanceName,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS'
            });

            logger.info(`Created WhatsApp instance: ${instanceName}`);

            // IMPORTANT: Auto-configure webhook immediately after creation
            if (webhookUrl) {
                try {
                    await this.setWebhook(instanceName, webhookUrl);
                    logger.info(`✅ Webhook auto-configured for ${instanceName}: ${webhookUrl}`);
                } catch (webhookError: any) {
                    logger.warn(`⚠️ Webhook auto-config failed (manual setup may be needed): ${webhookError.message}`);
                }
            }

            return response.data;
        } catch (error: any) {
            logger.error(`Failed to create instance: ${JSON.stringify(error.response?.data || error.message)}`);
            throw error;
        }
    }

    /**
     * Set webhook URL and events for an instance
     */
    async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
        if (await this.isMetaInstance(instanceName)) {
            // Meta webhooks are set in App Dashboard, not per instance via API
            return;
        }

        try {
            await this.client.post(`/webhook/set/${instanceName}`, {
                url: webhookUrl,
                webhook_by_events: false,
                webhook_base64: false,
                events: [
                    'MESSAGES_UPSERT',
                    'CONNECTION_UPDATE'
                ]
            });

            logger.info(`Webhook configured for ${instanceName}: ${webhookUrl}`);
        } catch (error: any) {
            logger.error(`Failed to set webhook: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get instance connection status
     */
    async getInstanceStatus(instanceName: string): Promise<WhatsAppInstance> {
        if (await this.isMetaInstance(instanceName)) {
            return {
                instanceName,
                state: 'open',
                status: 'open'
            };
        }

        try {
            const response = await this.client.get(`/instance/connectionState/${instanceName}`);
            return response.data;
        } catch (error: any) {
            logger.error(`Failed to get instance status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get QR code for WhatsApp connection
     */
    async getQRCode(instanceName: string): Promise<{ base64: string; code: string }> {
        if (await this.isMetaInstance(instanceName)) {
            throw new Error('META_API_NO_QR_CODE_REQUIRED');
        }

        try {
            logger.debug(`[EvolutionAPI] Fetching QR code for instance: ${instanceName}`);

            const response = await this.client.get(`/instance/connect/${instanceName}`);

            // Evolution API v2 returns QR data directly in response.data
            // Structure: { code: "2@...", base64: "data:image/png;base64,...", count: 1 }
            const qrData = response.data;

            logger.debug(`[EvolutionAPI] QR response keys: ${Object.keys(qrData).join(', ')}`);

            const base64 = qrData.base64 || qrData.qrcode?.base64 || '';
            const code = qrData.code || qrData.qrcode?.code || qrData.base64 || '';

            if (!base64 && !code) {
                logger.error(`[EvolutionAPI] No QR code found in response`, {
                    instanceName,
                    responseKeys: Object.keys(qrData),
                    responseData: JSON.stringify(qrData).substring(0, 200)
                });
                throw new Error('QR code not found in Evolution API response');
            }

            logger.info(`[EvolutionAPI] Got QR code for instance: ${instanceName}`, {
                hasBase64: !!base64,
                hasCode: !!code,
                base64Length: base64.length,
                codeLength: code.length
            });

            return {
                base64,
                code
            };
        } catch (error: any) {
            logger.error(`[EvolutionAPI] Failed to get QR code`, {
                instanceName,
                error: error.message,
                responseData: error.response?.data
            });
            throw error;
        }
    }

    /**
     * Get connection state
     */
    async getConnectionState(instanceName: string): Promise<{ state: string }> {
        if (await this.isMetaInstance(instanceName)) {
            return { state: 'open' };
        }

        try {
            const response = await this.client.get(`/instance/connectionState/${instanceName}`);
            // Normalize V2 response structure
            if (response.data?.instance?.state) {
                return { state: response.data.instance.state };
            }
            return response.data;
        } catch (error: any) {
            logger.error(`Failed to get connection state: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send text message
     */
    async sendTextMessage(instanceName: string, message: WhatsAppMessage): Promise<any> {
        // === FACADE ROUTING ===
        if (await this.isMetaInstance(instanceName)) {
            logger.info(`[EvolutionFacade] Routing message to Meta Service for ${instanceName}`);
            return metaWhatsAppService.sendTextMessage(instanceName, message);
        }

        try {
            const response = await this.client.post(`/message/sendText/${instanceName}`, {
                number: message.number,
                text: message.text,
                delay: message.delay || 1000,
            });

            logger.info(`Sent message to ${message.number} via ${instanceName}`);
            return response.data;
        } catch (error: any) {
            logger.error(`Failed to send message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Set typing status (simulate human-like behavior)
     */
    async setTyping(instanceName: string, number: string, isTyping: boolean): Promise<void> {
        if (await this.isMetaInstance(instanceName)) {
            return metaWhatsAppService.setTyping(instanceName, number, isTyping);
        }

        try {
            await this.client.post(`/chat/presence/${instanceName}`, {
                number,
                presence: isTyping ? 'composing' : 'paused',
            });
        } catch (error: any) {
            logger.error(`Failed to set typing status: ${error.message}`);
        }
    }

    /**
     * Delete instance
     */
    async deleteInstance(instanceName: string): Promise<void> {
        // Meta deletion? No-op or DB clear (handled by controller)
        if (await this.isMetaInstance(instanceName)) {
            return;
        }

        try {
            await this.client.delete(`/instance/delete/${instanceName}`);
            logger.info(`Deleted WhatsApp instance: ${instanceName}`);
        } catch (error: any) {
            logger.error(`Failed to delete instance: ${error.message}`);
            throw error;
        }
    }

    /**
     * Logout instance
     */
    async logoutInstance(instanceName: string): Promise<void> {
        if (await this.isMetaInstance(instanceName)) {
            return;
        }

        try {
            await this.client.delete(`/instance/logout/${instanceName}`);
            logger.info(`Logged out WhatsApp instance: ${instanceName}`);
        } catch (error: any) {
            logger.error(`Failed to logout instance: ${error.message}`);
            throw error;
        }
    }
}

export const evolutionAPI = new EvolutionAPIService();
export default evolutionAPI;
