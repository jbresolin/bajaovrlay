// Entry point: boots the BajaOvrLay server. Everything testable lives in
// createServerApp; this file only reads the environment, wires things up and listens.
import { serve } from '@hono/node-server';

import { readServerEnvironment } from './core/env/readServerEnvironment.js';
import { findBuiltPageFolder } from './core/http/builtPageFolders.js';
import { createServerApp } from './core/http/createServerApp.js';
import { createLogger } from './core/logger/createLogger.js';
import { readServerVersion } from './readServerVersion.js';

const environment = readServerEnvironment(process.env);
const logger = createLogger({ level: environment.LOG_LEVEL });
const version = readServerVersion();

// The built pages are looked up once, at boot. Building them later needs a restart.
const controlPageFolder = findBuiltPageFolder(new URL('../../control/dist/', import.meta.url));
const rendererPageFolder = findBuiltPageFolder(new URL('../../renderer/dist/', import.meta.url));
if (controlPageFolder === undefined) {
  logger.warn('control page is not built; run `pnpm build` to serve it at /');
}
if (rendererPageFolder === undefined) {
  logger.warn('renderer is not built; run `pnpm build` to serve it at /render/');
}

const app = createServerApp({ logger, version, controlPageFolder, rendererPageFolder });

const server = serve(
  { fetch: app.fetch, hostname: environment.HOST, port: environment.PORT },
  (address) => {
    logger.info({ host: environment.HOST, port: address.port, version }, 'server listening');
  },
);

// Stop accepting connections on Ctrl+C or a service stop, then exit cleanly.
function shutDown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'server shutting down');
  server.close(() => process.exit(0));
}
process.once('SIGINT', shutDown);
process.once('SIGTERM', shutDown);
