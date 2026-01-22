import 'dotenv/config';
import Fastify from 'fastify'
import { registerChatRoutes } from './routes/chat.js'
import { HttpError } from './lib/http.js';
import { cleanupExpiredSessions } from './context/store.js';
import cors from '@fastify/cors';

setInterval(() => cleanupExpiredSessions(), 60_000);


const app = Fastify({ logger: true });

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3001';

await app.register(cors, {
  origin: corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
});

// Global error handler (one place for consistent API errors)
app.setErrorHandler((err, _request, reply) => {
  if (err instanceof HttpError) {
    return reply.code(err.statusCode).send({
      error: err.message,
      details: err.details,
    });
  }

  app.log.error(err);
  return reply.code(500).send({ error: 'Internal Server Error' });
});

app.get('/health', async () => ({ status: 'ok' }));

await registerChatRoutes(app);

const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' });