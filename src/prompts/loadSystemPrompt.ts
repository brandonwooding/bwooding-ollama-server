// src/prompts/loadSystemPrompt.ts
import fs from 'node:fs';
import path from 'node:path';

export function loadSystemPrompt(): string {
  const filePath = path.join(
    process.cwd(),
    'src',
    'prompts',
    'system.md'
  );

  return fs.readFileSync(filePath, 'utf-8').trim();
}
