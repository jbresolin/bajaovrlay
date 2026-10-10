import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

import type { ServerAppEnvironment } from './httpContextVariables.js';

// A package name is one folder name: lowercase letters, digits and dashes. Anything
// else (dots, encoded slashes) is refused before a file path is ever built from it.
const graphicPackageNamePattern = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Serves built graphic packages: `/graphics/<package>/<file>` answers
 * `<graphicPackagesFolder>/<package>/dist/<file>`. Only `dist` is reachable; serveStatic
 * itself also refuses `..` segments and percent-encoded paths, so nothing can climb out.
 */
export function serveGraphicPackages(
  app: Hono<ServerAppEnvironment>,
  graphicPackagesFolder: string,
): void {
  const servePackageDistFiles = serveStatic<ServerAppEnvironment>({
    root: graphicPackagesFolder,
    rewriteRequestPath: insertDistFolderIntoGraphicsPath,
  });

  app.use('/graphics/:graphicPackageName/*', async (context, next) => {
    const isPlainPackageName = graphicPackageNamePattern.test(
      context.req.param('graphicPackageName'),
    );
    if (!isPlainPackageName) {
      return next();
    }
    return servePackageDistFiles(context, next);
  });
}

/** Turns `/graphics/race-clock/race-clock.js` into `/race-clock/dist/race-clock.js`. */
function insertDistFolderIntoGraphicsPath(requestPath: string): string {
  const pathAfterGraphics = requestPath.slice('/graphics/'.length);
  const endOfPackageName = pathAfterGraphics.indexOf('/');
  const graphicPackageName = pathAfterGraphics.slice(0, endOfPackageName);
  const pathInsidePackage = pathAfterGraphics.slice(endOfPackageName);
  return `/${graphicPackageName}/dist${pathInsidePackage}`;
}
