import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { parseBody } from '../lib/http.js';
import { DEFAULT_MODEL, ollamaChat } from '../ollama.js';

import { addUserMessage, addAssistantMessage, getMessages } from '../context/store.js';
import {
  logTurn,
  wordCount,
  contextWordCountFromMessages,
  newTurnId,
  getTurns,
} from '../analytics/store.js';

import { requireApiKey } from '../lib/auth.js';




const ChatBodySchema = z.object({
  sessionId: z.string().min(8, 'sessionId is required'),
  prompt: z.string().min(1, 'prompt is required'),
});

export async function registerChatRoutes(app: FastifyInstance) {
  app.post('/chat', async (request) => {
    requireApiKey(request.headers as Record<string, unknown>);
    
    const body = parseBody(ChatBodySchema, request.body);

    // 1) Store the user message in context
    const userAt = Date.now();
    addUserMessage(body.sessionId, body.prompt);

    // 2) Snapshot context size right before inference
    const messagesForInference = getMessages(body.sessionId);
    const contextWordCount = contextWordCountFromMessages(messagesForInference);

    // 3) Time the model call
    const t0 = performance.now();
    const result = await ollamaChat({
      model: DEFAULT_MODEL,
      messages: messagesForInference,
      stream: false,
    });
    const latencyMs = Math.round(performance.now() - t0);

    const assistantText = result.message.content;

    // 4) Store assistant response in context
    const assistantAt = Date.now();
    addAssistantMessage(body.sessionId, assistantText);

    // 5) Log analytics turn (user+assistant pair)
    logTurn({
      sessionId: body.sessionId,
      turnId: newTurnId(),
      user: {
        role: 'user',
        content: body.prompt,
        at: userAt,
        wordCount: wordCount(body.prompt),
      },
      assistant: {
        role: 'assistant',
        content: assistantText,
        at: assistantAt,
        wordCount: wordCount(assistantText),
      },
      latencyMs,
      contextWordCount,
    });

    return { text: assistantText };
  });

// ===== Dev-only analytics inspection =====
  app.get('/debug/sessions/:sessionId/turns', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    return {
      sessionId,
      turns: getTurns(sessionId),
    };
  });
}
