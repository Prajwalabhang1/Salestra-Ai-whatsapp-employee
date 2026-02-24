import { QdrantClient } from '@qdrant/js-client-rest';
import logger from './logger.js'; // Added .js extension

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY;

export const qdrant = new QdrantClient({
    url: qdrantUrl,
    apiKey: qdrantApiKey || undefined,
});

// Test connection
export async function initializeQdrant() {
    try {
        await qdrant.getCollections();
        logger.info('Qdrant connected successfully');
    } catch (error) {
        logger.error(`Qdrant connection error: ${error}`);
        throw error;
    }
}

export default qdrant;
