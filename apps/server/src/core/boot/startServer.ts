import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { serve } from '@hono/node-server';

import { openDatabase, type ServerDatabase } from '../db/openDatabase.js';
import { createServerApp } from '../http/createServerApp.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { startAutoOutScheduler } from '../store/autoOut.js';
import { createStateStore, type StateStore } from '../store/createStateStore.js';
import { startMacroRunner } from '../store/macroRunner.js';
import { defaultHeartbeatIntervalInMilliseconds } from '../ws/heartbeat.js';
import { attachWebSocketHub } from '../ws/webSocketHub.js';

/** Everything a boot needs; main.ts works these out from the environment. */
export type StartServerOptions = {
  logger: ServerLogger;
  version: string;
  host: string;
  /** 0 picks a free port (tests); the port actually used is in RunningServer.port. */
  port: number;
  databasePath: string;
  migrationsFolder: string;
  /** packages/graphics: registered as graphics at boot and served under /graphics/. */
  graphicPackagesFolder: string;
  controlPageFolder?: string | undefined;
  rendererPageFolder?: string | undefined;
  /** Defaults to 15 s; tests use a few milliseconds. */
  heartbeatIntervalInMilliseconds?: number | undefined;
  /**
   * The server's wall clock; defaults to the machine's. One clock for the store (which
   * stamps commands and race clock readings) and for the WebSocket hub (which tells
   * renderers what time it is), so the two can never disagree. Tests hold it still.
   */
  readCurrentTime?: (() => Date) | undefined;
};

/** A booted server: the port it listens on, its store, and how to stop it. */
export type RunningServer = {
  port: number;
  stateStore: StateStore;
  /**
   * Calls off pending auto-outs and a macro's pending wait, drops WebSocket clients, stops listening and closes
   * the database. Safe to call twice.
   */
  close: () => Promise<void>;
};

/**
 * Boots the whole server, in order: open the database and apply migrations (throws if
 * one fails, so the boot stops), load or seed the slices, build the HTTP app, listen,
 * and attach the WebSocket hub to the same port. Rejects if any step fails.
 */
export async function startServer(options: StartServerOptions): Promise<RunningServer> {
  const database = openDatabase({
    databasePath: options.databasePath,
    migrationsFolder: options.migrationsFolder,
  });
  try {
    return await startServingFromDatabase(database, options);
  } catch (bootError) {
    // A boot that fails after the database opened must not leave the file open.
    database.$client.close();
    throw bootError;
  }
}

/** The boot steps after the database is open: store, HTTP app, listen, WebSocket hub. */
async function startServingFromDatabase(
  database: ServerDatabase,
  options: StartServerOptions,
): Promise<RunningServer> {
  const stateStore = createStateStore({
    database,
    logger: options.logger,
    graphicPackagesFolder: options.graphicPackagesFolder,
    readCurrentTime: options.readCurrentTime,
  });
  // Started before anything can send a command, so no take of an item with an
  // auto-out delay is missed. It holds no timer until such a take happens.
  const autoOutScheduler = startAutoOutScheduler({ stateStore, logger: options.logger });
  // Started before anything can send a command too, so no runMacro is missed.
  const macroRunner = startMacroRunner({ stateStore, logger: options.logger });
  const app = createServerApp({
    logger: options.logger,
    version: options.version,
    stateStore,
    graphicPackagesFolder: options.graphicPackagesFolder,
    controlPageFolder: options.controlPageFolder,
    rendererPageFolder: options.rendererPageFolder,
  });
  const httpServer = await listen({
    fetch: app.fetch,
    hostname: options.host,
    port: options.port,
  });
  const webSocketHub = attachWebSocketHub({
    httpServer,
    stateStore,
    logger: options.logger,
    heartbeatIntervalInMilliseconds:
      options.heartbeatIntervalInMilliseconds ?? defaultHeartbeatIntervalInMilliseconds,
    readCurrentTime: options.readCurrentTime,
  });

  async function closeEverything(): Promise<void> {
    // First, so no auto-out or macro timer fires a command at a store whose database is
    // closing. A macro stopped mid-run is not resumed at the next boot.
    autoOutScheduler.stop();
    macroRunner.stop();
    await webSocketHub.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
      // Keep-alive connections would otherwise hold close() open until they time out.
      httpServer.closeAllConnections();
    });
    database.$client.close();
  }
  // Remembered so a second close() waits for the first instead of closing twice.
  let closingEverything: Promise<void> | undefined;

  return {
    port: (httpServer.address() as AddressInfo).port,
    stateStore,
    close: () => {
      closingEverything ??= closeEverything();
      return closingEverything;
    },
  };
}

/**
 * Starts listening and resolves once the port is open, or rejects if it cannot be
 * (for example, the port is already in use).
 */
function listen(serveOptions: {
  fetch: ReturnType<typeof createServerApp>['fetch'];
  hostname: string;
  port: number;
}): Promise<Server> {
  return new Promise((resolve, reject) => {
    // Without the http2/https options, @hono/node-server creates a node:http Server.
    const httpServer = serve(serveOptions, () => resolve(httpServer)) as Server;
    httpServer.once('error', reject);
  });
}
