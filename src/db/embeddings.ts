// src/db/embeddings.ts
import { db } from './client.js';

// Prepared statements for better performance
const insertChunkStmt = db.prepare(`
  INSERT INTO knowledge_chunks (source_file, chunk_index, heading, content, embedding, char_count, word_count, document_type, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const deleteAllChunksStmt = db.prepare(`DELETE FROM knowledge_chunks`);

const loadAllChunksStmt = db.prepare(`
  SELECT id, source_file, chunk_index, heading, content, embedding, char_count, word_count, document_type
  FROM knowledge_chunks
  ORDER BY source_file, chunk_index
`);

const insertRetrievalLogStmt = db.prepare(`
  INSERT INTO retrieval_logs (session_id, turn_id, query, chunks_retrieved, retrieval_latency_ms, classification, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export interface ChunkInput {
  sourceFile: string;
  chunkIndex: number;
  heading: string | null;
  content: string;
  embedding: number[];
  charCount: number;
  wordCount: number;
  documentType: string;
}

export interface ChunkOutput {
  id: number;
  sourceFile: string;
  chunkIndex: number;
  heading: string | null;
  content: string;
  embedding: number[];
  charCount: number;
  wordCount: number;
  documentType: string;
}

export interface RetrievalLog {
  sessionId: string;
  turnId: string | null;
  query: string;
  chunksRetrieved: number;
  retrievalLatencyMs: number;
  classification: string | null;
  createdAt: number;
}

/**
 * Insert chunks in batch using a transaction for atomicity.
 * Embeddings are JSON-serialized for storage.
 */
export function dbInsertChunksBatch(chunks: ChunkInput[]): void {
  if (chunks.length === 0) return;

  const insertMultiple = db.transaction((chunksToInsert: ChunkInput[]) => {
    for (const chunk of chunksToInsert) {
      insertChunkStmt.run(
        chunk.sourceFile,
        chunk.chunkIndex,
        chunk.heading,
        chunk.content,
        JSON.stringify(chunk.embedding),
        chunk.charCount,
        chunk.wordCount,
        chunk.documentType,
        Date.now()
      );
    }
  });

  insertMultiple(chunks);
}

/**
 * Load all chunks from the database.
 * Embeddings are JSON-parsed from storage.
 * This is used for in-memory caching at startup.
 */
export function dbLoadAllChunks(): ChunkOutput[] {
  const rows = loadAllChunksStmt.all() as Array<{
    id: number;
    source_file: string;
    chunk_index: number;
    heading: string | null;
    content: string;
    embedding: string;
    char_count: number;
    word_count: number;
    document_type: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    sourceFile: row.source_file,
    chunkIndex: row.chunk_index,
    heading: row.heading,
    content: row.content,
    embedding: JSON.parse(row.embedding) as number[],
    charCount: row.char_count,
    wordCount: row.word_count,
    documentType: row.document_type,
  }));
}

/**
 * Delete all chunks from the database.
 * Called before rebuilding the index.
 */
export function dbClearChunks(): void {
  deleteAllChunksStmt.run();
}

/**
 * Log a retrieval event for analytics.
 */
export function dbLogRetrieval(log: RetrievalLog): void {
  insertRetrievalLogStmt.run(
    log.sessionId,
    log.turnId,
    log.query,
    log.chunksRetrieved,
    log.retrievalLatencyMs,
    log.classification,
    log.createdAt
  );
}
