// src/embeddings/index.ts
import { chunkMarkdownDocument } from './chunker.js';
import { ollamaEmbed } from '../ollama.js';
import { dbInsertChunksBatch, dbClearChunks } from '../db/embeddings.js';
import fs from 'fs';
import path from 'path';

export interface IndexStats {
  totalChunks: number;
  totalFiles: number;
  durationMs: number;
}

/**
 * Build the embeddings index from markdown files in the knowledge base.
 * Clears existing chunks and rebuilds from scratch.
 */
export async function buildEmbeddingsIndex(): Promise<IndexStats> {
  const t0 = Date.now();
  const kbPath = process.env.KNOWLEDGE_BASE_PATH ?? './src/context/knowledge_base';

  console.log(`[Embeddings] Scanning knowledge base: ${kbPath}`);

  // 1. Scan directory for .md files
  if (!fs.existsSync(kbPath)) {
    throw new Error(`Knowledge base path does not exist: ${kbPath}`);
  }

  const files = fs.readdirSync(kbPath).filter((f) => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('[Embeddings] No markdown files found in knowledge base');
    return { totalChunks: 0, totalFiles: 0, durationMs: Date.now() - t0 };
  }

  console.log(`[Embeddings] Found ${files.length} markdown files`);

  // 2. Clear existing chunks
  console.log('[Embeddings] Clearing existing chunks...');
  dbClearChunks();

  // 3. Process each file
  const allChunks: Array<{
    sourceFile: string;
    chunkIndex: number;
    heading: string | null;
    content: string;
    embedding: number[];
    charCount: number;
    wordCount: number;
    documentType: string;
  }> = [];

  for (const file of files) {
    const filePath = path.join(kbPath, file);
    console.log(`[Embeddings] Processing ${file}...`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkMarkdownDocument(file, content);

    console.log(`[Embeddings]   Generated ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue; // Skip undefined chunks

      console.log(`[Embeddings]   Embedding chunk ${i + 1}/${chunks.length}...`);

      const embedding = await ollamaEmbed(chunk.content);
      allChunks.push({ ...chunk, embedding });
    }
  }

  // 4. Batch insert to DB
  console.log(`[Embeddings] Inserting ${allChunks.length} chunks into database...`);
  dbInsertChunksBatch(allChunks);

  const durationMs = Date.now() - t0;
  console.log(`[Embeddings] Index built successfully in ${durationMs}ms`);

  return {
    totalChunks: allChunks.length,
    totalFiles: files.length,
    durationMs,
  };
}
