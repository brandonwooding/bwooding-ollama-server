import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { parseBody } from '../lib/http.js';
import { DEFAULT_MODEL, ollamaChat } from '../ollama.js';

import { addUserMessage, addAssistantMessage, getMessagesWithRetrievedContext } from '../context/store.js';
import {
  logTurn,
  wordCount,
  contextWordCountFromMessages,
  newTurnId,
  getTurns,
} from '../analytics/store.js';

import { requireApiKey } from '../lib/auth.js';
import { retrieveRelevantChunks, formatChunksForContext, isGreetingOrConversational, classifyQueryIntent } from '../embeddings/retrieval.js';
import { dbLogRetrieval } from '../db/embeddings.js';
import { dbWriteSafe } from '../db/client.js';




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

    // 2) Classify the query
    const isGreeting = isGreetingOrConversational(body.prompt);
    const classification = isGreeting ? 'greeting' : classifyQueryIntent(body.prompt);

    // 3) Retrieve relevant knowledge chunks
    const retrievalT0 = performance.now();
    let retrievalResults;
    try {
      retrievalResults = await retrieveRelevantChunks(body.prompt, 3, 0.3);
    } catch (err) {
      console.error('[Chat] Retrieval error:', err);
      throw err; // Re-throw so we can see the full error
    }
    const retrievalLatencyMs = Math.round(performance.now() - retrievalT0);
    const retrievedContext = formatChunksForContext(retrievalResults);

    console.log(
      `[Chat] Retrieved ${retrievalResults.length} chunks for query in ${retrievalLatencyMs}ms`
    );
    if (retrievedContext) {
      console.log(`[Chat] Injecting ${retrievedContext.length} chars of context`);
    }

    // 3) Snapshot context with retrieved chunks
    const messagesForInference = getMessagesWithRetrievedContext(
      body.sessionId,
      retrievedContext
    );
    const contextWordCount = contextWordCountFromMessages(messagesForInference);

    // 4) Time the model call
    const t0 = performance.now();
    let result;
    try {
      console.log(`[Chat] Calling LLM with ${messagesForInference.length} messages, total context: ${contextWordCount} words`);
      result = await ollamaChat({
        model: DEFAULT_MODEL,
        messages: messagesForInference,
        stream: false,
      });
    } catch (err) {
      console.error('[Chat] LLM call error:', err);
      throw err;
    }
    const latencyMs = Math.round(performance.now() - t0);

    const assistantText = result.message.content;
    if (!assistantText || assistantText.trim() === '') {
      console.error('[Chat] LLM returned empty content!');
      console.error('[Chat] Messages sent to LLM:', JSON.stringify(messagesForInference, null, 2));
    }

    // 5) Store assistant response in context
    const assistantAt = Date.now();
    addAssistantMessage(body.sessionId, assistantText);

    // 6) Log analytics turn (user+assistant pair)
    const turnId = newTurnId();
    logTurn({
      sessionId: body.sessionId,
      turnId,
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

    // 7) Log retrieval event
    dbWriteSafe(() => {
      dbLogRetrieval({
        sessionId: body.sessionId,
        turnId,
        query: body.prompt,
        chunksRetrieved: retrievalResults.length,
        retrievalLatencyMs,
        classification,
        createdAt: userAt,
      });
    }, 'logRetrieval');

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
