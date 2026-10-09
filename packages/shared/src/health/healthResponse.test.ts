/**
 * Health response schema (packages/shared)
 *
 * What this module is for:
 *   HealthResponseSchema describes the body of `GET /health`. The server builds its
 *   answer from it and the control page checks what it receives against it, so both
 *   sides agree on the shape without trusting each other.
 *
 * What these tests prove:
 *   - A real health answer (`{ ok: true, version: '0.3.1' }`) is accepted as is.
 *   - An answer missing a field is rejected, and the failure message names the
 *     missing field, so a log line says what went wrong without opening the code.
 *
 * What these tests deliberately do not cover:
 *   - That the server actually sends this shape; the server's /health test checks that.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { HealthResponseSchema } from './healthResponse.js';

describe('HealthResponseSchema', () => {
  it('accepts the answer of a healthy server running version 0.3.1', () => {
    // Arrange: the body a healthy server sends.
    const healthyServerAnswer = { ok: true, version: '0.3.1' };

    // Act: check the body against the schema.
    const result = HealthResponseSchema.safeParse(healthyServerAnswer);

    // Assert: the body is accepted and comes back unchanged.
    expect(result.success, 'a complete health answer must be accepted').toBe(true);
    expect(result.data, 'the accepted answer must keep both fields as sent').toEqual({
      ok: true,
      version: '0.3.1',
    });
  });

  it('rejects an answer without a version and names the missing field', () => {
    // Arrange: an answer that forgot to say which version is running.
    const answerWithoutVersion = { ok: true };

    // Act: check the body against the schema and turn the failure into readable text.
    const result = HealthResponseSchema.safeParse(answerWithoutVersion);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: the body is refused and the message points at `version`.
    expect(result.success, 'an answer without a version must be rejected').toBe(false);
    expect(failureMessage, 'the failure message must name the missing field').toContain('version');
  });
});
