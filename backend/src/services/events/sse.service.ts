import { Response } from 'express';
import logger from '../../lib/logger.js';

interface SSEConnection {
    tenantId: string;
    res: Response;
    clientId: string;
    connectedAt: Date;
}

class SSEService {
    private connections: Map<string, SSEConnection[]> = new Map();

    /**
     * Add a new SSE connection for a tenant
     */
    addConnection(tenantId: string, res: Response, clientId: string): void {
        const connection: SSEConnection = {
            tenantId,
            res,
            clientId,
            connectedAt: new Date()
        };

        if (!this.connections.has(tenantId)) {
            this.connections.set(tenantId, []);
        }

        this.connections.get(tenantId)!.push(connection);
        logger.info(`✅ SSE connection added for tenant ${tenantId} (client: ${clientId})`);
        logger.info(`📊 Total connections for tenant: ${this.connections.get(tenantId)!.length}`);

        // Send initial heartbeat
        this.sendEvent(res, 'connected', { clientId, message: 'SSE connection established' });
    }

    /**
     * Remove a connection by client ID
     */
    removeConnection(clientId: string): void {
        for (const [tenantId, connections] of this.connections) {
            const initialCount = connections.length;
            const filtered = connections.filter(conn => conn.clientId !== clientId);

            if (filtered.length < initialCount) {
                this.connections.set(tenantId, filtered);
                logger.info(`🔌 SSE connection removed for client ${clientId}`);
                logger.info(`📊 Remaining connections for tenant ${tenantId}: ${filtered.length}`);

                // Clean up empty tenant entries
                if (filtered.length === 0) {
                    this.connections.delete(tenantId);
                    logger.info(`🧹 Removed tenant ${tenantId} from SSE connections (no active clients)`);
                }
                break;
            }
        }
    }

    /**
     * Broadcast an event to all connections for a specific tenant
     */
    broadcastToTenant(tenantId: string, event: string, data: any): void {
        const connections = this.connections.get(tenantId);

        if (!connections || connections.length === 0) {
            logger.debug(`📡 No SSE connections for tenant ${tenantId}, skipping broadcast`);
            return;
        }

        logger.info(`📢 Broadcasting '${event}' to ${connections.length} client(s) for tenant ${tenantId}`);

        let successCount = 0;
        let failureCount = 0;

        connections.forEach(({ res, clientId }) => {
            try {
                this.sendEvent(res, event, data);
                successCount++;
            } catch (error: any) {
                logger.error(`❌ Failed to send SSE event to client ${clientId}: ${error.message}`);
                failureCount++;
                // Connection is likely dead, will be cleaned up on next heartbeat or disconnect
            }
        });

        logger.info(`✅ Broadcast complete: ${successCount} success, ${failureCount} failures`);
    }

    /**
     * Broadcast a new message event to a tenant
     */
    broadcastNewMessage(tenantId: string, conversationData: any): void {
        this.broadcastToTenant(tenantId, 'new-message', {
            type: 'new-message',
            timestamp: new Date().toISOString(),
            conversation: conversationData
        });
    }

    /**
     * Send a heartbeat to all connections
     */
    sendHeartbeat(): void {
        let totalConnections = 0;
        for (const connections of this.connections.values()) {
            totalConnections += connections.length;
        }

        if (totalConnections === 0) {
            return;
        }

        logger.debug(`💓 Sending heartbeat to ${totalConnections} SSE connection(s)`);

        for (const [tenantId, connections] of this.connections) {
            connections.forEach(({ res, clientId }) => {
                try {
                    this.sendEvent(res, 'heartbeat', {
                        timestamp: new Date().toISOString()
                    });
                } catch (error: any) {
                    logger.warn(`⚠️ Heartbeat failed for client ${clientId}, will be cleaned up`);
                }
            });
        }
    }

    /**
     * Send an SSE event to a specific response stream
     */
    private sendEvent(res: Response, event: string, data: any): void {
        const payload = JSON.stringify(data);
        res.write(`event: ${event}\n`);
        res.write(`data: ${payload}\n\n`);
    }

    /**
     * Get connection statistics
     */
    getStats(): { totalTenants: number; totalConnections: number } {
        let totalConnections = 0;
        for (const connections of this.connections.values()) {
            totalConnections += connections.length;
        }

        return {
            totalTenants: this.connections.size,
            totalConnections
        };
    }

    /**
     * Start periodic heartbeat
     */
    startHeartbeat(intervalMs: number = 30000): NodeJS.Timeout {
        logger.info(`💓 Starting SSE heartbeat (interval: ${intervalMs}ms)`);
        return setInterval(() => this.sendHeartbeat(), intervalMs);
    }
}

// Export singleton instance
export const sseService = new SSEService();
