// src/scripts/build-embeddings.ts
import { buildEmbeddingsIndex } from '../embeddings/index.js';

async function main() {
  console.log('[Embeddings] Building knowledge base index...');

  try {
    const stats = await buildEmbeddingsIndex();

    console.log(`\n[Embeddings] ✓ Index built successfully!`);
    console.log(`  Files processed: ${stats.totalFiles}`);
    console.log(`  Chunks created: ${stats.totalChunks}`);
    console.log(`  Duration: ${stats.durationMs}ms`);

    process.exit(0);
  } catch (error) {
    console.error('\n[Embeddings] ✗ Build failed:', error);
    process.exit(1);
  }
}

main();
