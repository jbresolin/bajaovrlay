import { type HealthResponse, HealthResponseSchema } from '@bajaovrlay/shared';
import { Hono } from 'hono';

import type { ServerClockControl } from '../time/serverClockControl.js';
import type { ServerAppEnvironment } from './httpContextVariables.js';

/**
 * Builds the `GET /health` route, which answers `{ ok: true, version }`, and, given the
 * server clock's control, what the server clock knows of NTP (`serverClock`, for
 * "Verificar servidor"). The body is parsed through the shared schema before sending,
 * so the server cannot drift from it.
 */
export function createHealthRoute(
  version: string,
  serverClockControl?: ServerClockControl,
): Hono<ServerAppEnvironment> {
  const healthRoute = new Hono<ServerAppEnvironment>();

  healthRoute.get('/health', (context) => {
    const serverClock = serverClockControl?.readServerClockHealth();
    const healthResponse: HealthResponse = HealthResponseSchema.parse({
      ok: true,
      version,
      serverClock,
    });
    return context.json(healthResponse);
  });

  return healthRoute;
}
