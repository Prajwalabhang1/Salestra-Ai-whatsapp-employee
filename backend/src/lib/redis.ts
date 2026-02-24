import Redis from 'ioredis';
import logger from './logger.js'; // Added .js extension

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// @ts-ignore - ioredis constructor type mismatch in strict mode
export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) { // Added type
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError(err: Error) { // Added type
        logger.error(`Redis reconnect error: ${err.message}`);
        return true;
    },
});

redis.on('connect', () => {
    logger.info('Redis connected successfully');
});

redis.on('error', (err: Error) => { // Added type
    logger.error(`Redis error: ${err.message}`);
});

export default redis;
