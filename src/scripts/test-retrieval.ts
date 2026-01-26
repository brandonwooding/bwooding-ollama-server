// src/scripts/test-retrieval.ts
import { loadEmbeddingsCache } from '../embeddings/cache.js';
import { retrieveRelevantChunks } from '../embeddings/retrieval.js';

async function main() {
  console.log('[Test] Loading embeddings cache...');
  loadEmbeddingsCache();

  const testQueries = [
    'A new user has arrived. Do not react to their appearance - just greet and introduce yourself.',
    'When is Brandon\'s birthday?',
    'Where did Brandon go to university?',
    'What projects has Brandon built?',
  ];

  for (const query of testQueries) {
    console.log('\n' + '='.repeat(80));
    console.log(`Query: "${query}"`);
    console.log('='.repeat(80));

    const results = await retrieveRelevantChunks(query, 5, 0.0); // Get top 5, no threshold

    console.log(`\nTop 5 results:`);
    results.forEach((result, i) => {
      console.log(`\n${i + 1}. Similarity: ${result.similarity.toFixed(4)}`);
      console.log(`   Source: ${result.chunk.sourceFile}`);
      console.log(`   Heading: ${result.chunk.heading || 'None'}`);
      console.log(`   Content preview: ${result.chunk.content.substring(0, 150)}...`);
    });

    // Check how many pass threshold
    const above03 = results.filter((r) => r.similarity >= 0.3).length;
    const above05 = results.filter((r) => r.similarity >= 0.5).length;
    console.log(`\nAbove 0.3 threshold: ${above03}`);
    console.log(`Above 0.5 threshold: ${above05}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
