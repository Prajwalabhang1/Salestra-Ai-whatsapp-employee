import openai, { OPENAI_EMBEDDING_MODEL } from '../../lib/openai.js';
import logger from '../../lib/logger.js';

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

export interface DocumentChunk {
    content: string;
    metadata: {
        documentId: string;
        chunkIndex: number;
        totalChunks: number;
        [key: string]: any;
    };
}

/**
 * Split document into semantic chunks
 */
export function chunkDocument(
    content: string,
    documentId: string,
    metadata: any = {}
): DocumentChunk[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
        const trimmed = sentence.trim();

        if ((currentChunk + trimmed).length > CHUNK_SIZE && currentChunk.length > 0) {
            // Save current chunk
            chunks.push({
                content: currentChunk.trim(),
                metadata: {
                    documentId,
                    chunkIndex,
                    totalChunks: -1, // Will be updated later
                    ...metadata,
                },
            });

            // Start new chunk with overlap
            const words = currentChunk.split(' ');
            const overlapWords = words.slice(-CHUNK_OVERLAP);
            currentChunk = overlapWords.join(' ') + ' ' + trimmed;
            chunkIndex++;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + trimmed;
        }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
        chunks.push({
            content: currentChunk.trim(),
            metadata: {
                documentId,
                chunkIndex,
                totalChunks: chunkIndex + 1,
                ...metadata,
            },
        });
    }

    // Update total chunks count
    const totalChunks = chunks.length;
    chunks.forEach(chunk => {
        chunk.metadata.totalChunks = totalChunks;
    });

    return chunks;
}

/**
 * Generate embeddings for text chunks using configured provider
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const provider = process.env.DEFAULT_EMBEDDING_PROVIDER || 'openai';

    try {
        if (provider === 'ollama') {
            return await generateOllamaEmbeddings(texts);
        } else {
            return await generateOpenAIEmbeddings(texts);
        }
    } catch (error: any) {
        logger.error(`Error generating embeddings (${provider}): ${error.message}`);
        // Fallback to OpenAI if Ollama fails (or vice versa? No, sticking to config for now)
        throw error;
    }
}

async function generateOpenAIEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await openai.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: texts,
    });
    const embeddings = response.data.map((item: any) => item.embedding);
    logger.debug(`Generated ${embeddings.length} embeddings (OpenAI)`);
    return embeddings;
}

async function generateOllamaEmbeddings(texts: string[]): Promise<number[][]> {
    const model = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text:latest';
    const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

    // Switch to new /api/embed endpoint (Ollama > 0.1.28)
    const embeddings = await Promise.all(texts.map(async (text) => {
        try {
            // Try new API first
            const response = await fetch(`${baseUrl}/api/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    input: text // 'input' instead of 'prompt'
                })
            });

            if (response.ok) {
                const data: any = await response.json();
                return data.embeddings[0]; // Returns array of arrays
            }

            // Fallback to old API if 404
            if (response.status === 404) {
                logger.warn(`Ollama /api/embed 404, trying /api/embeddings...`);
                const oldResponse = await fetch(`${baseUrl}/api/embeddings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        prompt: text
                    })
                });

                if (!oldResponse.ok) {
                    const errText = await oldResponse.text();
                    throw new Error(`Ollama /api/embeddings error: ${oldResponse.status} ${oldResponse.statusText} - ${errText}`);
                }

                const data: any = await oldResponse.json();
                return data.embedding;
            }

            const errText = await response.text();
            throw new Error(`Ollama error: ${response.status} ${response.statusText} - ${errText}`);

        } catch (e: any) {
            logger.error(`Embedding generation failed for text "${text.substring(0, 20)}...": ${e.message}`);
            throw e;
        }
    }));

    logger.debug(`Generated ${embeddings.length} embeddings (Ollama)`);
    return embeddings;
}

/**
 * Generate single embedding
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await generateEmbeddings([text]);
    return embeddings[0];
}

/**
 * Batch process documents for embedding
 */
export async function batchEmbedDocuments(
    chunks: DocumentChunk[],
    batchSize: number = 100
): Promise<Array<{ chunk: DocumentChunk; embedding: number[] }>> {
    const results: Array<{ chunk: DocumentChunk; embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map(c => c.content);

        try {
            const embeddings = await generateEmbeddings(texts);

            batch.forEach((chunk, idx) => {
                results.push({
                    chunk,
                    embedding: embeddings[idx],
                });
            });

            logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}: ${batch.length} chunks`);
        } catch (error) {
            logger.error(`Error processing batch: ${error}`);
            throw error;
        }
    }

    return results;
}
