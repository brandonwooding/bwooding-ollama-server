// src/embeddings/cache.ts
import { dbLoadAllChunks, type ChunkOutput } from '../db/embeddings.js';

let cachedChunks: ChunkOutput[] | null = null;

/**
 * Load all embeddings chunks from the database into memory.
 * This should be called once at server startup.
 */
export function loadEmbeddingsCache(): void {
  console.log('[Embeddings Cache] Loading chunks from database...');
  cachedChunks = dbLoadAllChunks();
  console.log(`[Embeddings Cache] Loaded ${cachedChunks.length} chunks`);
}

/**
 * Get the cached chunks.
 * Returns an empty array if cache hasn't been loaded yet.
 */
export function getCachedChunks(): ChunkOutput[] {
  if (cachedChunks === null) {
    console.warn('[Embeddings Cache] Cache not loaded yet, returning empty array');
    return [];
  }
  return cachedChunks;
}

/**
 * Clear the cache (useful for testing or rebuilding index).
 */
export function clearCache(): void {
  cachedChunks = null;
}
