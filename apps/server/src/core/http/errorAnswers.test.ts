/**
 * Unexpected errors (apps/server)
 *
 * What this module is for:
 *   When a route throws something nobody planned for, the server still answers in
 *   JSON with a pt-BR message, so the control page can show it, and keeps the details
 *   (the stack trace) in its own log.
 *
 * What these tests prove:
 *   - A route that throws answers 500 with a stable code and a pt-BR message.
 *   - The internal error text never reaches the client.
 *
 * What these tests deliberately do not cover:
 *   - The log line itself; the logger is silenced here and the JSON shape is pino's.
 *   - The 404 answer, which healthRoute.test.ts covers.
 */
import { describe, expect, it } from 'vitest';

import { createLogger } from '../logger/createLogger.js';
import { createServerApp } from './createServerApp.js';

const internalErrorText = 'falha ao ler a tabela de voltas da equipe 42';

/** Builds the server app with one extra route that always throws, standing in for a bug. */
function createServerAppWithARouteThatThrows() {
  const app = createServerApp({
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
  });
  app.get('/api/v1/voltas-com-defeito', () => {
    throw new Error(internalErrorText);
  });
  return app;
}

describe('an unexpected error while handling a request', () => {
  it('answers 500 with a JSON error in pt-BR and no internal details', async () => {
    // Arrange: a server app with a route that throws.
    const app = createServerAppWithARouteThatThrows();

    // Act: call that route.
    const response = await app.request('/api/v1/voltas-com-defeito');
    const bodyText = await response.text();

    // Assert: a 500 in JSON with the pt-BR message, and the internal text kept out.
    expect(response.status, 'an unexpected error must answer 500').toBe(500);
    expect(JSON.parse(bodyText), 'the error must carry a stable code and a pt-BR message').toEqual({
      error: {
        code: 'UNEXPECTED_SERVER_ERROR',
        message:
          'Erro inesperado no servidor. Procure no log do servidor o request_id desta resposta.',
      },
    });
    expect(bodyText, 'the internal error text must stay in the server log').not.toContain(
      internalErrorText,
    );
  });
});
