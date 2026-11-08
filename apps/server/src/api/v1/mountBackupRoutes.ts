import { Readable } from 'node:stream';

import type { OpenAPIHono } from '@hono/zod-openapi';

import { allowTheControlPageOrRequireApiAccess } from '../../core/apiAccess/allowTheControlPageOrRequireApiAccess.js';
import type { ApiTokens } from '../../core/apiAccess/apiTokens.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
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
 * Mounts GET /api/v1/backup and GET /api/v1/backup/summary (BAJAOVRLAY-33) behind the
 * history's access: the control page's own fetch and link pass with no token, any other
 * caller goes through the command API's rules. Thin: parse, authorise, call the module.
 */
export function mountBackupRoutes(
  apiRoutes: OpenAPIHono<ServerAppEnvironment>,
  options: {
    backupDownloads: BackupDownloads;
    apiTokens: ApiTokens;
    isOpenToTheNetwork: boolean;
  },
): void {
  const accessOfTheControlPage = allowTheControlPageOrRequireApiAccess(options);

  apiRoutes.openapi({ ...getBackupSummaryRoute, middleware: [accessOfTheControlPage] }, (context) =>
    context.json(options.backupDownloads.summarizeTheBackup(), 200),
  );

  apiRoutes.openapi(
    { ...getBackupRoute, middleware: [accessOfTheControlPage] },
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
