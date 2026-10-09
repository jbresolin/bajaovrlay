import { type HealthResponse, HealthResponseSchema } from '@bajaovrlay/shared';
import { Hono } from 'hono';

import type { ServerAppEnvironment } from './httpContextVariables.js';

/**
 * Builds the `GET /health` route, which answers `{ ok: true, version }`. The body is
 * parsed through the shared schema before sending, so the server cannot drift from it.
 */
export function createHealthRoute(version: string): Hono<ServerAppEnvironment> {
  const healthRoute = new Hono<ServerAppEnvironment>();

  healthRoute.get('/health', (context) => {
    const healthResponse: HealthResponse = HealthResponseSchema.parse({ ok: true, version });
    return context.json(healthResponse);
  });

  return healthRoute;
}
