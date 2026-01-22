import { loadSystemPrompt } from './prompts/loadSystemPrompt.js';

export const SYSTEM_PROMPT = loadSystemPrompt();

export const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:1b'

export type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export type OllamaChatRequest = {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
};

export type OllamaChatResponse = {
    message: ChatMessage;
};

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';

export async function ollamaChat(req: OllamaChatRequest): Promise<OllamaChatResponse> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, { 
        method: 'POST', 
        headers: { 'content-type': 'application/json'},
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama error ${res.status}: ${text}`)
    }

    return (await res.json()) as OllamaChatResponse;
}