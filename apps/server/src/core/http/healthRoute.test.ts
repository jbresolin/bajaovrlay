/**
 * Health check and unknown addresses (apps/server)
 *
 * What this module is for:
 *   `GET /health` is how the operator, OBS and CI ask "is the server up, and which
 *   version is running?". Any address the server does not know must still answer in
 *   JSON, so the control page can always read the reply instead of choking on HTML.
 *
 * What these tests prove:
 *   - `/health` answers 200 with a body that passes the shared HealthResponseSchema
 *     and carries the version the server was started with.
 *   - An unknown address answers 404 with a JSON error whose message is in pt-BR.
 *
 * What these tests deliberately do not cover:
 *   - The real network socket: the app is called in memory through `app.request()`,
 *     which runs the same routes and middleware without opening a port.
 *   - Serving the built control page and renderer. That only happens when their
 *     `dist` folders exist, and is checked by hand with `pnpm build` then `pnpm start`.
 */
import { HealthResponseSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../logger/createLogger.js';
import { createServerApp } from './createServerApp.js';

const runningServerVersion = '0.3.1';

/** Builds the server app as production does, but silent and without static folders. */
function createServerAppForHealthTests() {
  return createServerApp({
    logger: createLogger({ level: 'silent' }),
    version: runningServerVersion,
  });
}

describe('GET /health', () => {
  it('answers 200 with a body that passes the shared schema and names the version', async () => {
    // Arrange: a server app that believes it is version 0.3.1.
    const app = createServerAppForHealthTests();

    // Act: ask for /health, exactly as the control page does.
    const response = await app.request('/health');
    const body: unknown = await response.json();

    // Assert: the answer is 200 OK and the body is what the shared schema describes.
    const parsedBody = HealthResponseSchema.safeParse(body);
    expect(response.status, 'the health check must answer 200 OK').toBe(200);
    expect(parsedBody.success, 'the body must pass the shared HealthResponseSchema').toBe(true);
    expect(body, 'the body must say the server is ok and name its version').toEqual({
      ok: true,
      version: '0.3.1',
    });
  });
});

describe('an address the server does not know', () => {
  it('answers 404 with a JSON error in pt-BR, not an HTML page', async () => {
    // Arrange: the same server app, with no route for scoreboards.
    const app = createServerAppForHealthTests();

    // Act: ask for an address that does not exist, as a mistyped URL would.
    const response = await app.request('/api/v1/placar-inexistente');
    const body: unknown = await response.json();

    // Assert: the answer is a 404 in JSON with a stable code and a pt-BR message.
    expect(response.status, 'an unknown address must answer 404 Not Found').toBe(404);
    expect(
      response.headers.get('content-type'),
      'the 404 must be JSON so every client can parse it',
    ).toContain('application/json');
    expect(body, 'the error must carry a stable code and a message in pt-BR').toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Endereço não encontrado no servidor.',
      },
    });
  });
});
