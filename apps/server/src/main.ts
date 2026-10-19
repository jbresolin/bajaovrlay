// Entry point: boots the BajaOvrLay server. Everything testable lives in startServer;
// this file only reads the environment, works out the paths and handles exit.
import { fileURLToPath } from 'node:url';

import { startServer } from './core/boot/startServer.js';
import { committedMigrationsFolder } from './core/db/openDatabase.js';
import { readServerEnvironment } from './core/env/readServerEnvironment.js';
import { resolveDatabasePath } from './core/env/resolveDatabasePath.js';
import { resolveDataFolder } from './core/env/resolveDataFolder.js';
import { findBuiltPageFolder } from './core/http/builtPageFolders.js';
import { createLogger } from './core/logger/createLogger.js';
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
const databasePath = resolveDatabasePath(environment.DATABASE_PATH, repositoryRootFolder);
const dataFolder = resolveDataFolder(environment.DATA_DIR, repositoryRootFolder);

// The built pages are looked up once, at boot. Building them later needs a restart.
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
    dataFolder,
    sourceHostAllowlist: environment.BAJAOVRLAY_SOURCE_ALLOWED_HOSTS,
    controlPageFolder,
    rendererPageFolder,
  });
  logger.info(
    {
      host: environment.HOST,
      port: runningServer.port,
      version,
      database_path: databasePath,
      data_folder: dataFolder,
    },
    'server listening',
  );

  // On Ctrl+C or a service stop: drop WebSocket clients, stop listening, close the
  // database, then exit.
  const shutDown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'server shutting down');
    await runningServer.close();
    process.exit(0);
  };
  process.once('SIGINT', (signal) => void shutDown(signal));
  process.once('SIGTERM', (signal) => void shutDown(signal));
} catch (bootError) {
  // Fail closed: a server that cannot open or migrate its database must not run.
  logger.fatal({ err: bootError, database_path: databasePath }, 'server failed to boot');
  process.exit(1);
}
