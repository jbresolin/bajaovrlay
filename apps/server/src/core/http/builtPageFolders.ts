import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

import type { ServerAppEnvironment } from './httpContextVariables.js';

/**
 * Returns the absolute path of a built page folder (a Vite `dist`), or undefined when
 * it has not been built. The URL is resolved from the calling file, not from the
 * folder the server was started in, so `pnpm start` works from any directory.
 */
export function findBuiltPageFolder(folderUrl: URL): string | undefined {
  const folderPath = fileURLToPath(folderUrl);
  if (!existsSync(folderPath)) {
    return undefined;
  }
  return folderPath;
}

/**
 * Serves the built renderer at `/render/`, where OBS loads it. `/render` without the
 * slash redirects, because the page's relative asset paths only work under `/render/`.
 */
export function serveRendererPage(app: Hono<ServerAppEnvironment>, rendererFolder: string): void {
  app.get('/render', (context) => context.redirect('/render/', 301));
  app.use(
    '/render/*',
    serveStatic({
      root: rendererFolder,
      rewriteRequestPath: (requestPath) => requestPath.slice('/render'.length),
    }),
  );
}

/**
 * Serves the built control page at `/`. Registered after every other route, so a file
 * in the control page's `dist` can never hide an API address.
 */
export function serveControlPage(app: Hono<ServerAppEnvironment>, controlFolder: string): void {
  app.use('/*', serveStatic({ root: controlFolder }));
}
