/**
 * WhatsApp QR Code Polling Utilities
 * Handles auto-refresh and connection status polling
 */

import { useEffect, useRef, useState } from 'react';
import { api } from './api-client';

export interface QRCodeState {
    qrCode: string | null;
    expiresIn: number; // Seconds remaining
    connected: boolean;
    error: string | null;
    loading: boolean;
}

/**
 * Hook for managing WhatsApp QR code with auto-refresh
 * Auto-refreshes QR code every 50 seconds
 * Polls connection status every 2 seconds
 */
export function useWhatsAppQRCode(instanceId: string | null) {
    const [state, setState] = useState<QRCodeState>({
        qrCode: null,
        expiresIn: 60,
        connected: false,
        error: null,
        loading: true
    });

    const pollIntervalRef = useRef<NodeJS.Timeout>();
    const qrRefreshIntervalRef = useRef<NodeJS.Timeout>();
    const expiryTimerRef = useRef<NodeJS.Timeout>();

    // Load QR code
    const loadQRCode = async () => {
        if (!instanceId) return;

        try {
            setState(prev => ({ ...prev, loading: true, error: null }));

            const response = await api.get(`/api/onboarding/qr-code/${instanceId}`);

            setState(prev => ({
                ...prev,
                qrCode: response.data.base64 || response.data.code,
                expiresIn: 60,
                loading: false
            }));

            console.log('[QR Code] Loaded successfully');
        } catch (error: any) {
            console.error('[QR Code] Load failed:', error);
            setState(prev => ({
                ...prev,
                error: error.message || 'Failed to load QR code',
                loading: false
            }));
        }
    };

    // Check connection status
    const checkConnection = async () => {
        if (!instanceId) return;

        try {
            const response = await api.get(`/api/onboarding/connection-status/${instanceId}`);

            if (response.data.connected) {
                setState(prev => ({ ...prev, connected: true }));

                // Stop polling when connected
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                if (qrRefreshIntervalRef.current) clearInterval(qrRefreshIntervalRef.current);
                if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);

                console.log('[QR Code] WhatsApp connected!');
            }
        } catch (error) {
            console.error('[QR Code] Status check failed:', error);
        }
    };

    // Start polling and refresh timers
    useEffect(() => {
        if (!instanceId || state.connected) return;

        // Initial load
        loadQRCode();

        // Poll connection status every 2 seconds
        pollIntervalRef.current = setInterval(checkConnection, 2000);

        // Refresh QR code every 50 seconds (before 60s expiry)
        qrRefreshIntervalRef.current = setInterval(loadQRCode, 50000);

        // Countdown timer (update every second)
        expiryTimerRef.current = setInterval(() => {
            setState(prev => {
                const newExpiry = prev.expiresIn - 1;

                // Auto-refresh when timer hits 0
                if (newExpiry <= 0) {
                    loadQRCode();
                    return { ...prev, expiresIn: 60 };
                }

                return { ...prev, expiresIn: newExpiry };
            });
        }, 1000);

        // Cleanup
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (qrRefreshIntervalRef.current) clearInterval(qrRefreshIntervalRef.current);
            if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
        };
    }, [instanceId, state.connected]);

    return {
        ...state,
        refreshQRCode: loadQRCode
    };
}

/**
 * Format seconds into MM:SS
 */
export function formatTimeRemaining(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default {
    useWhatsAppQRCode,
    formatTimeRemaining
};
