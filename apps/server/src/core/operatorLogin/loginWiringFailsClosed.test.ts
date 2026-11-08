/**
 * The login is wired in everywhere, or the server does not compile (apps/server)
 *
 * What this module is for:
 *   The HTTP app, the /api/v1 routes and the WebSocket hub each decide who gets in from the
 *   operator login (BAJAOVRLAY-29). If one of them quietly fell back to "no login" when it
 *   was not handed the login, a wiring slip in startServer would open the console to the
 *   whole network with the PINs set, and nothing would say so. So each of the three requires
 *   the login object: leaving it out is a type error, caught by `pnpm typecheck` before the
 *   server can run (gate 2 of PR #51). Tests of other things pass the login off explicitly
 *   (operatorLoginOff.testSupport.ts).
 *
 * What these tests prove (checked by the TypeScript compiler, which `pnpm verify` runs):
 *   - createServerApp's, createApiV1Routes's and attachWebSocketHub's `operatorLogin` is
 *     exactly an OperatorLogin: not optional, not undefined.
 *
 * What these tests deliberately do not cover:
 *   - What each one does with the login; operatorRouteAccess.test.ts and
 *     webSocketHubOperatorSession.test.ts.
 */
import { describe, expectTypeOf, it } from 'vitest';

import { createApiV1Routes } from '../../api/v1/createApiV1Routes.js';
import type { ServerAppOptions } from '../http/createServerApp.js';
import type { WebSocketHubOptions } from '../ws/webSocketHub.js';
import type { OperatorLogin } from './operatorLogin.js';

describe('the operator login in the server’s wiring', () => {
  it('is required by the HTTP app', () => {
    // Arrange: the type of the app's login option.
    type LoginOptionOfTheApp = ServerAppOptions['operatorLogin'];

    // Act: (nothing runs: the compiler reads the type.)

    // Assert: exactly the login; an optional one would also allow undefined.
    expectTypeOf<LoginOptionOfTheApp>().toEqualTypeOf<OperatorLogin>();
  });

  it('is required by the /api/v1 routes', () => {
    // Arrange: the type of the routes' login option.
    type LoginOptionOfTheRoutes = Parameters<typeof createApiV1Routes>[0]['operatorLogin'];

    // Act: (nothing runs: the compiler reads the type.)

    // Assert: exactly the login.
    expectTypeOf<LoginOptionOfTheRoutes>().toEqualTypeOf<OperatorLogin>();
  });

  it('is required by the WebSocket hub', () => {
    // Arrange: the type of the hub's login option.
    type LoginOptionOfTheHub = WebSocketHubOptions['operatorLogin'];

    // Act: (nothing runs: the compiler reads the type.)

    // Assert: exactly the login.
    expectTypeOf<LoginOptionOfTheHub>().toEqualTypeOf<OperatorLogin>();
  });
});
