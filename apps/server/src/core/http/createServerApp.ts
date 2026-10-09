import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

import type { ServerLogger } from '../logger/createLogger.js';
import { serveControlPage, serveRendererPage } from './builtPageFolders.js';
import { answerRouteNotFound, answerUnexpectedError } from './errorAnswers.js';
import { createHealthRoute } from './healthRoute.js';
import type { ServerAppEnvironment } from './httpContextVariables.js';
import { logEachRequest } from './requestLogging.js';

/** Everything the server app needs; main.ts reads these from the environment. */
export type ServerAppOptions = {
  logger: ServerLogger;
  /** The version reported by /health (the server's package.json version). */
  version: string;
  /** Absolute path of apps/control/dist; leave out when the control page is not built. */
  controlPageFolder?: string | undefined;
  /** Absolute path of apps/renderer/dist; leave out when the renderer is not built. */
  rendererPageFolder?: string | undefined;
};

/**
 * Builds the server's HTTP app without opening a port. main.ts listens with it; tests
 * call `app.request()` on it directly. The order of the steps below is the order a
 * request passes through them.
 */
export function createServerApp(options: ServerAppOptions): Hono<ServerAppEnvironment> {
  const app = new Hono<ServerAppEnvironment>();

  // Every request gets an id (or keeps the one it arrived with), echoed as x-request-id.
  app.use(requestId());
  app.use(logEachRequest(options.logger));

  app.route('/', createHealthRoute(options.version));

  if (options.rendererPageFolder !== undefined) {
    serveRendererPage(app, options.rendererPageFolder);
  }
  // The control page is served last: it answers `/*`, so anything after it would be hidden.
  if (options.controlPageFolder !== undefined) {
    serveControlPage(app, options.controlPageFolder);
  }

  app.notFound(answerRouteNotFound);
  app.onError(answerUnexpectedError);

  return app;
}
