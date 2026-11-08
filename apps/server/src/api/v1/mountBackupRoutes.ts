import { Readable } from 'node:stream';

import type { OpenAPIHono } from '@hono/zod-openapi';

import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import {
  middlewareForTheAccessOfRoute,
  type RouteAccessOptions,
} from '../../core/operatorLogin/routeAccess.js';
import {
  type BackupDownloads,
  buildBackupAlreadyRunningAnswer,
  buildBackupZipHeaders,
  buildDatabaseStayedLockedAnswer,
  buildInvalidBackupQueryAnswer,
  getBackupRoute,
  getBackupSummaryRoute,
} from '../../modules/backup/index.js';

/**
 * Mounts GET /api/v1/backup and GET /api/v1/backup/summary (BAJAOVRLAY-33) with the access
 * core/operatorLogin/routeAccess.ts gives them: a session of either role, since a backup
 * changes nothing on air (open to all while the login is off). Thin: parse, authorise,
 * call the module.
 */
export function mountBackupRoutes(
  apiRoutes: OpenAPIHono<ServerAppEnvironment>,
  options: {
    backupDownloads: BackupDownloads;
    routeAccessOptions: RouteAccessOptions;
  },
): void {
  const summaryMiddleware = middlewareForTheAccessOfRoute(
    getBackupSummaryRoute,
    options.routeAccessOptions,
  );
  apiRoutes.openapi({ ...getBackupSummaryRoute, middleware: summaryMiddleware }, (context) =>
    context.json(options.backupDownloads.summarizeTheBackup(), 200),
  );

  const downloadMiddleware = middlewareForTheAccessOfRoute(
    getBackupRoute,
    options.routeAccessOptions,
  );
  apiRoutes.openapi(
    { ...getBackupRoute, middleware: downloadMiddleware },
    async (context) => {
      const query = context.req.valid('query');
      const isIncludingRecordings = query.includeRecordings !== 'false';
      // The request's signal: a client that hangs up during the copy stops the backup.
      const backup = await options.backupDownloads.startBackupDownload(
        isIncludingRecordings,
        context.req.raw.signal,
      );
      if (!backup.isStarted && backup.reason === 'alreadyRunning') {
        return context.json(buildBackupAlreadyRunningAnswer(), 409);
      }
      if (!backup.isStarted) {
        return context.json(buildDatabaseStayedLockedAnswer(), 503);
      }
      // Readable.toWeb reads the zip only as fast as the connection takes it; a browser
      // that cancels the download cancels the web stream, which stops the zip.
      const zipAsWebStream = Readable.toWeb(backup.zipStream) as ReadableStream<Uint8Array>;
      return new Response(zipAsWebStream, {
        status: 200,
        headers: buildBackupZipHeaders(backup.fileName),
      });
    },
    // The only thing the query can get wrong is includeRecordings.
    (validation, context) => {
      if (validation.success) {
        return undefined;
      }
      return context.json(buildInvalidBackupQueryAnswer(), 400);
    },
  );
}
