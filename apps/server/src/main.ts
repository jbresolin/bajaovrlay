// Entry point: boots the BajaOvrLay server. Everything testable lives in startServer;
// this file only reads the environment, works out the paths and handles exit.
import { fileURLToPath } from 'node:url';

import { shutDownTheServer } from './core/boot/shutDownTheServer.js';
import { startServer } from './core/boot/startServer.js';
import { committedMigrationsFolder } from './core/db/openDatabase.js';
import { readServerEnvironment } from './core/env/readServerEnvironment.js';
import { resolveDatabasePath } from './core/env/resolveDatabasePath.js';
import { resolveDataFolder } from './core/env/resolveDataFolder.js';
import { findBuiltPageFolder } from './core/http/builtPageFolders.js';
import { createLogger } from './core/logger/createLogger.js';
import { buildIdFileUrl } from './readBuildId.js';
import { readServerVersion } from './readServerVersion.js';

const environment = readServerEnvironment(process.env);
const logger = createLogger({ level: environment.LOG_LEVEL });
const version = readServerVersion();

// Every path is resolved from this file (src/main.ts, or dist/main.js once built: the
// same depth), never from the folder the server was started in.
const repositoryRootFolder = fileURLToPath(new URL('../../../', import.meta.url));
const graphicPackagesFolder = fileURLToPath(
  new URL('../../../packages/graphics/', import.meta.url),
);
const themeFolder = fileURLToPath(new URL('../../../packages/theme/', import.meta.url));
const databasePath = resolveDatabasePath(environment.DATABASE_PATH, repositoryRootFolder);
const dataFolder = resolveDataFolder(environment.DATA_DIR, repositoryRootFolder);

// The built page folders are looked up once, at boot: building them for the first time
// later needs a restart, while a rebuild of a folder found here is served at once.
const controlPageFolder = findBuiltPageFolder(new URL('../../control/dist/', import.meta.url));
const rendererPageFolder = findBuiltPageFolder(new URL('../../renderer/dist/', import.meta.url));
if (controlPageFolder === undefined) {
  logger.warn('control page is not built; run `pnpm build` to serve it at /');
}
if (rendererPageFolder === undefined) {
  logger.warn('renderer is not built; run `pnpm build` to serve it at /render/');
}

try {
  const runningServer = await startServer({
    logger,
    version,
    host: environment.HOST,
    port: environment.PORT,
    databasePath,
    migrationsFolder: committedMigrationsFolder,
    graphicPackagesFolder,
    themeFolder,
    dataFolder,
    sourceHostAllowlist: environment.BAJAOVRLAY_SOURCE_ALLOWED_HOSTS,
    publicOrigins: environment.BAJAOVRLAY_PUBLIC_ORIGINS,
    controlPageFolder,
    rendererPageFolder,
    buildIdFileUrl,
  });
  logger.info(
    {
      host: environment.HOST,
      port: runningServer.port,
      version,
      build_id: runningServer.buildId,
      database_path: databasePath,
      data_folder: dataFolder,
    },
    'server listening',
  );
  // startServer read build-id.json once, at boot; that id is the one every hello names.
  if (runningServer.buildId === undefined) {
    logger.warn('no build-id.json; open pages will not reload themselves after an upgrade');
  }

  // On Ctrl+C or a service stop (`docker stop`): drop WebSocket clients, stop listening,
  // close the database, then exit; 1, with the error logged, if closing fails.
  const shutDown = (signal: NodeJS.Signals): Promise<void> =>
    shutDownTheServer({ runningServer, logger, signal, exitProcess: (code) => process.exit(code) });
  process.once('SIGINT', (signal) => void shutDown(signal));
  process.once('SIGTERM', (signal) => void shutDown(signal));
} catch (bootError) {
  // Fail closed: a server that cannot open or migrate its database must not run.
  logger.fatal({ err: bootError, database_path: databasePath }, 'server failed to boot');
  process.exit(1);
}
