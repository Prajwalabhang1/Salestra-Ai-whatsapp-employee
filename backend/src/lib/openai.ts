import OpenAI from 'openai';
import logger from './logger.js';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    logger.warn('⚠️  OPENAI_API_KEY not set - OpenAI features will be unavailable');
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null as any;

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
export const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';

export default openai;
