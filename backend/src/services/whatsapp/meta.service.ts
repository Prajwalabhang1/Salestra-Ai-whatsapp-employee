import axios, { AxiosInstance } from 'axios';
import logger from '../../lib/logger.js';
import prisma from '../../lib/prisma.js';

export interface MetaMessage {
    recipient_type: 'individual';
    to: string;
    type: 'text';
    text: {
        body: string;
    };
}

export class MetaWhatsAppService {
    private client: AxiosInstance;
    private baseUrl: string = 'https://graph.facebook.com/v21.0';

    constructor() {
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });

        // Log initialization
        logger.info(`[MetaWhatsApp] Service Initialized (Base URL: ${this.baseUrl})`);
    }

    /**
     * Get instance configuration (Phone ID + Token) from DB.
     * In Parallel mode, we rely on these fields existing to determine if we should use Meta.
     */
    async getConfig(instanceId: string): Promise<{ phoneNumberId: string; accessToken: string } | null> {
        try {
            // We search by whatsappInstanceId which acts as the common identifier
            const tenant = await prisma.tenant.findFirst({
                where: { whatsappInstanceId: instanceId },
                select: { metaPhoneNumberId: true, metaAccessToken: true }
            });

            if (tenant?.metaPhoneNumberId && tenant?.metaAccessToken) {
                return {
                    phoneNumberId: tenant.metaPhoneNumberId,
                    accessToken: tenant.metaAccessToken
                };
            }
            return null;
        } catch (error) {
            logger.error(`[MetaWhatsApp] Failed to get config for instance ${instanceId}: ${error}`);
            return null;
        }
    }

    /**
     * Send text message via Meta API
     */
    async sendTextMessage(instanceId: string, message: { number: string; text: string }): Promise<any> {
        const config = await this.getConfig(instanceId);
        if (!config) {
            throw new Error(`Meta credentials not found for instance: ${instanceId}`);
        }

        try {
            const url = `/${config.phoneNumberId}/messages`;
            const payload: MetaMessage = {
                recipient_type: 'individual',
                to: message.number,
                type: 'text',
                text: {
                    body: message.text
                }
            };

            const response = await this.client.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`
                }
            });

            logger.info(`[MetaWhatsApp] Sent message to ${message.number} via ${instanceId}`);
            return response.data;
        } catch (error: any) {
            logger.error(`[MetaWhatsApp] Failed to send message: ${error.message}`);
            if (error.response) {
                logger.error(`[MetaWhatsApp] Response: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    // --- Stub methods for feature parity ---

    async setTyping(instanceId: string, number: string, isTyping: boolean): Promise<void> {
        // Meta API doesn't support persistent typing indicators easily in the same way.
        // We log and ignore to prevent errors in shared logic.
        return;
    }
}

export const metaWhatsAppService = new MetaWhatsAppService();
