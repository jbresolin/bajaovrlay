import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

import type { ServerAppEnvironment } from './httpContextVariables.js';

// The folders of packages/theme a browser reads: the tokens, the font CSS and file, the
// logo. The motion helper's source (src/) and package.json stay on the server.
const servedThemeFolderNames = ['ardosia', 'fonts', 'brand'];

// A font file or a logo is not edited in place: when one changes it gets a new file, so
// OBS may keep what it has for a year. The trade-off: replacing logo-branca.png under
// the same name needs OBS's browser cache cleared, so give a changed logo a new name.
const cacheForAYear = 'public, max-age=31536000, immutable';
// tokens.css and fonts.css are small and are edited by hand: an edit must show on the
// next reload of the renderer, so the browser always asks the server first.
const alwaysAskTheServer = 'no-cache';

/**
 * Serves the theme: `/theme/<folder>/<file>` answers `<themeFolder>/<folder>/<file>`
 * for the three folders a browser needs, with a cache header chosen per file kind.
 * serveStatic refuses `..` segments and percent-encoded paths, so nothing can climb out.
 */
export function serveThemeFiles(app: Hono<ServerAppEnvironment>, themeFolder: string): void {
  const serveFilesOfTheThemeFolder = serveStatic<ServerAppEnvironment>({
    root: themeFolder,
    rewriteRequestPath: removeThemePrefixFromPath,
  });

  app.use('/theme/:themeFolderName/*', async (context, next) => {
    const isServedFolder = servedThemeFolderNames.includes(context.req.param('themeFolderName'));
    if (!isServedFolder) {
      return next();
    }
    const response = await serveFilesOfTheThemeFolder(context, next);
    // serveStatic builds the Response before giving a chance to add headers, so the
    // cache header is set on the Response it answered; no Response means no file found.
    if (response instanceof Response) {
      response.headers.set('Cache-Control', chooseCacheControlForThemeFile(context.req.path));
    }
    return response;
  });
}

/** Turns `/theme/ardosia/tokens.css` into `/ardosia/tokens.css`. */
function removeThemePrefixFromPath(requestPath: string): string {
  return requestPath.slice('/theme'.length);
}

/** A year for the font file and the logo; always ask the server for everything else. */
function chooseCacheControlForThemeFile(requestPath: string): string {
  const isFontFileOrImage = requestPath.endsWith('.woff2') || requestPath.endsWith('.png');
  if (isFontFileOrImage) {
    return cacheForAYear;
  }
  return alwaysAskTheServer;
}
