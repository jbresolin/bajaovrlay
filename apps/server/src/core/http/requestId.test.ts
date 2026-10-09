/**
 * Request ids (apps/server)
 *
 * What this module is for:
 *   Every request the server handles gets a `request_id`. It is written on every log
 *   line about that request and sent back in the `x-request-id` header, so an answer
 *   seen in the browser can be matched to the server's log lines.
 *
 * What these tests prove:
 *   - A request that arrives without an id gets a fresh one in the answer.
 *   - A request that arrives with an id (for example from a proxy) keeps that id.
 *
 * What these tests deliberately do not cover:
 *   - The content of the log lines themselves; the logger is silenced here and the
 *     JSON shape is pino's, which this repository does not re-test.
 */
import { describe, expect, it } from 'vitest';

import { createLogger } from '../logger/createLogger.js';
import { createServerApp } from './createServerApp.js';

/** Builds the server app as production does, but silent and without static folders. */
function createServerAppForRequestIdTests() {
  return createServerApp({
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
  });
}

describe('request ids', () => {
  it('gives a request that arrives without an id a fresh one in the answer', async () => {
    // Arrange: a server app, and a request with no x-request-id header.
    const app = createServerAppForRequestIdTests();

    // Act: ask for /health.
    const response = await app.request('/health');

    // Assert: the answer carries a request id that is not empty.
    const requestId = response.headers.get('x-request-id');
    expect(requestId, 'every answer must carry an x-request-id header').not.toBeNull();
    expect(requestId?.length, 'the generated request id must not be empty').toBeGreaterThan(0);
  });

  it('keeps the id a request arrives with', async () => {
    // Arrange: a server app, and a request already tagged by an upstream proxy.
    const app = createServerAppForRequestIdTests();
    const idFromProxy = 'etapa-piracicaba-0042';

    // Act: ask for /health with that id in the x-request-id header.
    const response = await app.request('/health', {
      headers: { 'x-request-id': idFromProxy },
    });

    // Assert: the answer echoes the same id, so both sides log the same value.
    expect(
      response.headers.get('x-request-id'),
      'an id sent by the client must be echoed back unchanged',
    ).toBe('etapa-piracicaba-0042');
  });
});
