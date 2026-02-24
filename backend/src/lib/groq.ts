import Groq from 'groq-sdk';
import logger from './logger.js';

const apiKey = process.env.GROQ_API_KEY;
const apiKey2 = process.env.GROQ_API_KEY_2;

if (!apiKey && !apiKey2) {
    logger.warn('⚠️  No GROQ_API_KEY set - Groq features will be unavailable');
}

export const groq = apiKey ? new Groq({ apiKey }) : null as any;
export const groq2 = apiKey2 ? new Groq({ apiKey: apiKey2 }) : null as any;

export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

export default groq;
