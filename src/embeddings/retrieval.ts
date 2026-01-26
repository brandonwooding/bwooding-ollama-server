// src/embeddings/retrieval.ts
import { ollamaEmbed } from '../ollama.js';
import { getCachedChunks } from './cache.js';
import type { DocumentChunk } from './chunker.js';

export interface RetrievalResult {
  chunk: DocumentChunk;
  similarity: number;
}

/**
 * Check if query is a greeting or conversational phrase that doesn't need retrieval.
 */
export function isGreetingOrConversational(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  const greetings = [
    "hi", "hello", "hey", "howdy", "greetings", "good morning", "good afternoon", "good evening",
    "sup", "wassup", "yo", "hiya"
  ];

  const conversational = [
    "how are you", "how's it going", "what's up", "how do you do",
    "nice to meet you", "pleased to meet you",
    "thanks", "thank you", "thx", "cheers",
    "bye", "goodbye", "see you", "later", "farewell"
  ];

  // Check if entire query is just a greeting
  if (greetings.includes(lowerQuery)) {
    return true;
  }

  // Check if query starts with greeting
  if (greetings.some(g => lowerQuery.startsWith(g + " ") || lowerQuery.startsWith(g + "!"))) {
    return true;
  }

  // Check conversational phrases
  if (conversational.some(c => lowerQuery.includes(c))) {
    return true;
  }

  return false;
}

/**
 * Classify query intent based on keywords.
 * Returns "project" | "personal" | "general"
 */
export function classifyQueryIntent(query: string): "project" | "personal" | "general" {
  const lowerQuery = query.toLowerCase();

  const projectKeywords = [
    // Direct project terms
    "project", "projects", "portfolio", "work on", "worked on", "work", "working on",

    // Creation & development
    "built", "build", "building", "created", "create", "creating", "developed", "develop", "developing",
    "made", "make", "making", "designed", "design", "designing", "implemented", "implement", "implementing",
    "coded", "code", "coding", "programmed", "program", "programming",

    // Technology & tools
    "tech stack", "technology", "technologies", "tool", "tools", "framework", "frameworks",
    "library", "libraries", "software", "application", "app", "system", "platform",

    // Project types
    "bot", "agent", "agents", "multi-agent", "agentic", "ai system", "chatbot",
    "web app", "website", "api", "backend", "frontend",

    // Competition & events
    "hackathon", "hackathons", "competition", "competitions", "demo", "presentation",
    "won", "award", "awards", "prize", "winner", "winning", "place", "1st", "first place",

    // Project-specific terms from Brandon's work
    "wordle", "pacer", "tracer", "markus", "observability", "git", "python",
    "langchain", "langgraph", "ollama", "selenium", "google adk"
  ];

  const personalKeywords = [
    // Birth & age
    "born", "birth", "birthday", "birthdate", "birth date", "date of birth", "dob",
    "age", "old", "how old", "when was he", "when were you",

    // Location & origin
    "from", "where", "where is", "where was", "where does", "where did",
    "live", "lives", "lived", "living", "location", "based", "resides", "residing",
    "nationality", "citizen", "country", "city", "town", "trinidad", "london",

    // Education (comprehensive)
    "education", "educated", "studied", "study", "studying", "studies",
    "university", "universities", "uni", "college", "school", "schools",
    "degree", "degrees", "graduated", "graduate", "graduation", "graduating",
    "major", "majored", "minor", "attended", "attend", "attending", "go to", "went to",
    "ucl", "imperial", "undergraduate", "postgraduate", "masters", "master's", "msc", "bsc",
    "bachelor", "phd", "student", "academic", "course", "courses", "class", "undergrad", "postgrad",

    // Background & history
    "background", "history", "story", "upbringing", "childhood", "grew up",
    "raised", "early life", "youth", "young",

    // Family
    "family", "families", "parent", "parents", "sibling", "siblings", "trinidad",
    "brother", "sister", "mother", "father", "mom", "dad", "relative", "relatives",

    // Interests & hobbies
    "interest", "interests", "interested", "hobby", "hobbies", "passion", "passionate",
    "like", "likes", "enjoy", "enjoys", "love", "loves", "favorite", "favourite",
    "prefer", "prefers", "fan of", "into", "keen on",

    // Career & employment (personal aspects)
    "worked at", "work at", "working at", "works at", "employed", "employment",
    "job", "jobs", "career", "career path", "experience", "role", "position",
    "company", "companies", "employer", "accenture", "consulting", "consultant"
  ];

  // Helper function to check if keyword exists as whole word
  const containsWholeWord = (text: string, keyword: string): boolean => {
    // Escape special regex characters in keyword
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundaries to match whole words only
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    return regex.test(text);
  };

  // Check project keywords first (more specific)
  if (projectKeywords.some(kw => containsWholeWord(lowerQuery, kw))) {
    return "project";
  }

  if (personalKeywords.some(kw => containsWholeWord(lowerQuery, kw))) {
    return "personal";
  }

  return "general";
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between 0 and 1 (higher is more similar).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal === undefined || bVal === undefined) continue;

    dotProduct += aVal * bVal;
    magnitudeA += aVal * aVal;
    magnitudeB += bVal * bVal;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Retrieve the top-K most relevant chunks for a given query.
 * Uses cosine similarity on embeddings with intent-based filtering.
 */
export async function retrieveRelevantChunks(
  query: string,
  topK: number = 3,
  minSimilarity: number = 0.3
): Promise<RetrievalResult[]> {
  // 1. Check if query is a greeting - skip retrieval
  if (isGreetingOrConversational(query)) {
    console.log('[Retrieval] Classification: greeting/conversational - skipping retrieval');
    return [];
  }

  // 2. Classify query intent (before embedding to avoid unnecessary API calls)
  const intent = classifyQueryIntent(query);
  console.log(`[Retrieval] Classification: ${intent}`);

  // 3. Skip retrieval for general queries (no embedding needed, fast return)
  if (intent === "general") {
    console.log('[Retrieval] General query - skipping retrieval');
    return [];
  }

  // 4. Embed the query (only for project/personal queries)
  const queryEmbedding = await ollamaEmbed(query);

  // 5. Load all chunks from cache
  const allChunks = getCachedChunks();

  if (allChunks.length === 0) {
    console.log('[Retrieval] No chunks available in cache');
    return [];
  }

  // 6. Filter chunks by document type based on intent
  const filteredChunks = allChunks.filter(chunk => {
    if (intent === "project") return chunk.documentType === "project";
    if (intent === "personal") return chunk.documentType === "personal_info";
    return false;
  });

  console.log(`[Retrieval] Filtered to ${filteredChunks.length} chunks (type: ${intent})`);

  if (filteredChunks.length === 0) {
    console.log('[Retrieval] No chunks match the document type filter');
    return [];
  }

  // 7. Compute cosine similarity on filtered chunks
  const results: RetrievalResult[] = filteredChunks.map((chunk) => ({
    chunk: {
      sourceFile: chunk.sourceFile,
      chunkIndex: chunk.chunkIndex,
      heading: chunk.heading,
      content: chunk.content,
      charCount: chunk.charCount,
      wordCount: chunk.wordCount,
      documentType: chunk.documentType,
    },
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // 8. Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  // 9. Filter by minimum similarity threshold
  const filtered = results.filter((r) => r.similarity >= minSimilarity);

  // Debug logging
  console.log(`[Retrieval] Query: "${query.slice(0, 80)}..."`);
  console.log(`[Retrieval] Top 5 similarities:`);
  results.slice(0, 5).forEach((r, i) => {
    console.log(
      `  ${i + 1}. [${r.similarity.toFixed(3)}] ${r.chunk.sourceFile} (${r.chunk.documentType}) - ${r.chunk.heading || 'No heading'}`
    );
  });
  console.log(`[Retrieval] Filtered: ${filtered.length} chunks above ${minSimilarity} threshold`);
  console.log(`[Retrieval] Returning top-${topK}: ${filtered.slice(0, topK).length} chunks`);

  // 10. Return top-K
  return filtered.slice(0, topK);
}

/**
 * Format retrieved chunks for injection into context.
 * Returns empty string if no results.
 */
export function formatChunksForContext(results: RetrievalResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const formatted = results
    .map((result) => {
      const source = result.chunk.sourceFile.replace('.md', '');
      return `[RETRIEVED CONTEXT from ${source}]\n${result.chunk.content}`;
    })
    .join('\n\n');

  return formatted;
}
