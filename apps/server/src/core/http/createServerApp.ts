import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

import { createApiV1Routes } from '../../api/v1/createApiV1Routes.js';
import type { BackupDownloads } from '../../modules/backup/index.js';
import type {
  ReadEnvironmentVariable,
  SourceHostAllowlist,
} from '../../modules/dataSources/index.js';
import { serveMediaFiles } from '../../modules/media/index.js';
import type { ApiTokens } from '../apiAccess/apiTokens.js';
import type { ServerLogger } from '../logger/createLogger.js';
import type { OperatorLogin } from '../operatorLogin/operatorLogin.js';
import type { StateStore } from '../store/createStateStore.js';
import { serveControlPage, serveRendererPage } from './builtPageFolders.js';
import { answerRouteNotFound, answerUnexpectedError } from './errorAnswers.js';
import { serveGraphicPackages } from './graphicPackages.js';
import { createHealthRoute } from './healthRoute.js';
import type { ServerAppEnvironment } from './httpContextVariables.js';
import { logEachRequest } from './requestLogging.js';
import { serveThemeFiles } from './themeFiles.js';

/** Everything the server app needs; main.ts reads these from the environment. */
export type ServerAppOptions = {
  logger: ServerLogger;
  /** The version reported by /health (the server's package.json version). */
  version: string;
  /** Absolute path of apps/control/dist; leave out when the control page is not built. */
  controlPageFolder?: string | undefined;
  /** Absolute path of apps/renderer/dist; leave out when the renderer is not built. */
  rendererPageFolder?: string | undefined;
  /** The store behind /api/v1; leave out in tests that do not touch state. */
  stateStore?: StateStore | undefined;
  /** Absolute path of packages/graphics, served at /graphics/<package>/ from each dist. */
  graphicPackagesFolder?: string | undefined;
  /** Absolute path of packages/theme, served at /theme/ (its ardosia/, fonts/ and brand/ only). */
  themeFolder?: string | undefined;
  /** How the flex sample route reads BAJAOVRLAY_SOURCE_ variables; process.env when left out. */
  readSourceEnvironmentVariable?: ReadEnvironmentVariable | undefined;
  /** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot, for the sample route; no list when left out. */
  sourceHostAllowlist?: SourceHostAllowlist | undefined;
  /** The flex sample route's timeout; 10 s when left out (tests shorten it). */
  sampleRequestTimeoutInMilliseconds?: number | undefined;
  /**
   * DATA_DIR/media: uploads (POST /api/v1/media) are written there and served at
   * /media/<mediaId>. Both need the store; leave out in tests that touch no image.
   */
  mediaFolder?: string | undefined;
  /** BAJAOVRLAY_API_TOKENS as read at boot; the command API answers 403 when left out. */
  apiTokens?: ApiTokens | undefined;
  /** BAJAOVRLAY_API_OPEN as read at boot: the command API with no token; not open when left out. */
  isApiOpenToTheNetwork?: boolean | undefined;
  /**
   * BAJAOVRLAY_PUBLIC_ORIGINS as read at boot: the addresses of a reverse proxy whose pages
   * may upload images too. None when left out: only the server's own address may.
   */
  publicOrigins?: readonly string[] | undefined;
  /** The backup downloads (BAJAOVRLAY-33): GET /api/v1/backup; leave out in tests that make none. */
  backupDownloads?: BackupDownloads | undefined;
  /**
   * The operator login (BAJAOVRLAY-29) startServer built from the PINs. Required, with no
   * default (gate 2 of PR #51): a wiring that forgot it must not compile into an open console.
   */
  operatorLogin: OperatorLogin;
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

  if (options.stateStore !== undefined) {
    app.route(
      '/api/v1',
      createApiV1Routes({
        stateStore: options.stateStore,
        version: options.version,
        readSourceEnvironmentVariable: options.readSourceEnvironmentVariable,
        sourceHostAllowlist: options.sourceHostAllowlist,
        sampleRequestTimeoutInMilliseconds: options.sampleRequestTimeoutInMilliseconds,
        mediaFolder: options.mediaFolder,
        apiTokens: options.apiTokens,
        isApiOpenToTheNetwork: options.isApiOpenToTheNetwork,
        publicOrigins: options.publicOrigins,
        backupDownloads: options.backupDownloads,
        operatorLogin: options.operatorLogin,
      }),
    );
    if (options.mediaFolder !== undefined) {
      serveMediaFiles(app, { stateStore: options.stateStore, mediaFolder: options.mediaFolder });
    }
  }
  if (options.graphicPackagesFolder !== undefined) {
    serveGraphicPackages(app, options.graphicPackagesFolder);
  }
  if (options.themeFolder !== undefined) {
    serveThemeFiles(app, options.themeFolder);
  }

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
