/**
 * API Configuration Service
 * Centralizes all API URLs and environment settings
 */

export const API_CONFIG = {
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3000',
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL || 'http://host.docker.internal:3000'
};

export const CORS_ORIGINS = [
    API_CONFIG.FRONTEND_URL,
    process.env.ADDITIONAL_CORS_ORIGIN
].filter((origin): origin is string => !!origin);

export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
