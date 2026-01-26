// src/embeddings/chunker.ts

export interface DocumentChunk {
  sourceFile: string;
  chunkIndex: number;
  heading: string | null;
  content: string;
  charCount: number;
  wordCount: number;
  documentType: string;
}

const MAX_WORDS_PER_CHUNK = 600;
const MIN_WORDS_PER_CHUNK = 50;

/**
 * Infer document type from filename.
 * - "brandon-details.md" → "personal_info"
 * - "project-*.md" or "*-overview.md" → "project"
 * - Default → "general"
 */
function inferDocumentType(filename: string): string {
  const lower = filename.toLowerCase();

  if (lower === 'brandon-details.md') {
    return 'personal_info';
  }

  if (lower.startsWith('project-') || lower.includes('-overview.md')) {
    return 'project';
  }

  return 'general';
}

/**
 * Count words in a string (simple whitespace-based count)
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

/**
 * Split a large section into smaller chunks at paragraph boundaries.
 */
function splitLargeSection(content: string, heading: string | null): string[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = heading ? `${heading}\n\n` : '';

  for (const paragraph of paragraphs) {
    const testChunk = currentChunk + (currentChunk.endsWith('\n\n') ? '' : '\n\n') + paragraph;

    if (countWords(testChunk) > MAX_WORDS_PER_CHUNK && currentChunk.length > 0) {
      // Current chunk is full, start a new one
      chunks.push(currentChunk.trim());
      currentChunk = heading ? `${heading}\n\n${paragraph}` : paragraph;
    } else {
      currentChunk = testChunk;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [content];
}

/**
 * Chunk a markdown document by ## headers.
 * Returns an array of chunks with metadata.
 */
export function chunkMarkdownDocument(
  filepath: string,
  content: string
): DocumentChunk[] {
  const documentType = inferDocumentType(filepath);
  const lines = content.split('\n');
  const sections: Array<{ heading: string | null; content: string }> = [];
  let currentHeading: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check if line is a ## header (not # or ###, specifically ##)
    if (line.match(/^##\s+/)) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join('\n'),
        });
      }

      currentHeading = line;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save final section
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join('\n'),
    });
  }

  // If no sections found (no ## headers), treat entire document as one section
  if (sections.length === 0) {
    sections.push({
      heading: null,
      content: content,
    });
  }

  // Process sections into chunks
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue; // Skip undefined sections

    const fullContent = section.heading
      ? `${section.heading}\n\n${section.content.trim()}`
      : section.content.trim();

    const wordCount = countWords(fullContent);

    // If section is too large, split it
    if (wordCount > MAX_WORDS_PER_CHUNK) {
      const subChunks = splitLargeSection(section.content.trim(), section.heading);

      for (const subChunk of subChunks) {
        chunks.push({
          sourceFile: filepath,
          chunkIndex: chunkIndex++,
          heading: section.heading,
          content: subChunk,
          charCount: subChunk.length,
          wordCount: countWords(subChunk),
          documentType,
        });
      }
    }
    // If section is too small, merge with next section (if possible)
    else if (
      wordCount < MIN_WORDS_PER_CHUNK &&
      i < sections.length - 1
    ) {
      const nextSection = sections[i + 1];
      if (
        nextSection &&
        wordCount + countWords(nextSection.content) < MAX_WORDS_PER_CHUNK
      ) {
        // Merge with next section
        const mergedContent = section.heading
          ? `${section.heading}\n\n${section.content.trim()}\n\n${
              nextSection.heading || ''
            }\n\n${nextSection.content.trim()}`
          : `${section.content.trim()}\n\n${nextSection.heading || ''}\n\n${nextSection.content.trim()}`;

        chunks.push({
          sourceFile: filepath,
          chunkIndex: chunkIndex++,
          heading: section.heading || nextSection.heading,
          content: mergedContent.trim(),
          charCount: mergedContent.trim().length,
          wordCount: countWords(mergedContent.trim()),
          documentType,
        });

        // Skip next section since we merged it
        i++;
        continue;
      }
    }

    // Normal size section (or couldn't merge)
    chunks.push({
      sourceFile: filepath,
      chunkIndex: chunkIndex++,
      heading: section.heading,
      content: fullContent,
      charCount: fullContent.length,
      wordCount,
      documentType,
    });
  }

  return chunks;
}
