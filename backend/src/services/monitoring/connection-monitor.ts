/**
 * WhatsApp Connection Monitor Service
 * Monitors all Evolution API instances and updates tenant status
 */

import prisma from '../../lib/prisma.js';
import { evolutionAPI } from '../whatsapp/evolution.service.js';
import logger from '../../lib/logger.js';

const CHECK_INTERVAL_MS = 60000; // 1 minute
let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Check connection status for all tenants
 */
async function checkAllConnections() {
    try {
        const tenants = await prisma.tenant.findMany({
            where: {
                whatsappInstanceId: { not: null }
            }
        });

        logger.debug(`[Connection Monitor] Checking ${tenants.length} WhatsApp instances...`);

        for (const tenant of tenants) {
            if (!tenant.whatsappInstanceId) continue;

            try {
                const state = await evolutionAPI.getConnectionState(tenant.whatsappInstanceId);

                const isConnected = state.state === 'open';
                const currentStatus = tenant.status;

                // Connection restored
                if (isConnected && (currentStatus === 'inactive' || currentStatus === 'whatsapp_setup_pending')) {
                    await prisma.tenant.update({
                        where: { id: tenant.id },
                        data: { status: 'active' }
                    });
                    logger.info(`✅ Tenant ${tenant.id} (${tenant.businessName}) WhatsApp reconnected`);
                }

                // Connection lost
                if (!isConnected && currentStatus === 'active') {
                    await prisma.tenant.update({
                        where: { id: tenant.id },
                        data: { status: 'inactive' }
                    });
                    logger.warn(`⚠️  Tenant ${tenant.id} (${tenant.businessName}) WhatsApp disconnected`);

                    // TODO: Send alert to tenant
                    // await sendTenantAlert(tenant.id, 'whatsapp_disconnected');
                }

            } catch (error: any) {
                logger.error(`[Connection Monitor] Failed to check tenant ${tenant.id}: ${error.message}`);
                // Don't mark as inactive on temporary errors
            }
        }

    } catch (error: any) {
        logger.error(`[Connection Monitor] Error checking connections: ${error.message}`);
    }
}

/**
 * Start the connection monitor
 */
export function startConnectionMonitor() {
    if (monitorInterval) {
        logger.warn('[Connection Monitor] Already running');
        return;
    }

    logger.info(`[Connection Monitor] Starting (interval: ${CHECK_INTERVAL_MS}ms)`);

    // Do first check immediately
    checkAllConnections();

    // Then check periodically
    monitorInterval = setInterval(checkAllConnections, CHECK_INTERVAL_MS);
}

/**
 * Stop the connection monitor
 */
export function stopConnectionMonitor() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        logger.info('[Connection Monitor] Stopped');
    }
}

/**
 * Get monitor status
 */
export function getMonitorStatus() {
    return {
        isRunning: monitorInterval !== null,
        checkIntervalMs: CHECK_INTERVAL_MS
    };
}

export default {
    start: startConnectionMonitor,
    stop: stopConnectionMonitor,
    getStatus: getMonitorStatus,
};
