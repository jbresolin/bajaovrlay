import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Slices } from '@bajaovrlay/shared';
import { serve } from '@hono/node-server';

import { createBackupDownloads } from '../../modules/backup/index.js';
import { startBindingService } from '../../modules/bindings/index.js';
import {
  buildRecordingsFolderPath,
  type SourceHostAllowlist,
  startDataSourceService,
} from '../../modules/dataSources/index.js';
import { startEventInboxService } from '../../modules/events/index.js';
import { buildMediaFolderPath, startMediaService } from '../../modules/media/index.js';
import { type ObsConnectionSettings, startObsConnection } from '../../modules/obs/index.js';
import { startTriggerService } from '../../modules/triggers/index.js';
import { readBuildId } from '../../readBuildId.js';
import type { ApiTokens } from '../apiAccess/apiTokens.js';
import { openDatabase, type ServerDatabase } from '../db/openDatabase.js';
import { createServerApp } from '../http/createServerApp.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { createOperatorLogin } from '../operatorLogin/operatorLogin.js';
import { operatorLoginTurnedOff, type OperatorPins } from '../operatorLogin/operatorPins.js';
import { startAutoOutScheduler } from '../store/autoOut.js';
import { createStateStore, type StateStore } from '../store/createStateStore.js';
import { startMacroRunner } from '../store/macroRunner.js';
import type { HttpTimeSettings } from '../time/httpTimeSettings.js';
import type { NtpSettings } from '../time/ntpSettings.js';
import { readServerTime, serverClockOfTheProcess } from '../time/serverClock.js';
import {
  type ServerClockControl,
  serverClockWithNtpOff,
  startTheServerClockOnNtp,
} from '../time/serverClockControl.js';
import { isAnythingCountingTimeOnAnOutput } from '../time/timeCountedOnAnOutput.js';
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
  /**
   * packages/theme: served under /theme/ for the renderer page and the graphics. Left out
   * only by tests that never open a page; main.ts always passes it.
   */
  themeFolder?: string | undefined;
  /**
   * DATA_DIR, absolute: the server's files other than the database. Recordings are
   * written to, and listed at boot from, its `recordings` folder; uploaded images are
   * kept in its `media` folder.
   */
  dataFolder: string;
  /**
   * BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot. Required here, so production cannot
   * leave it out by mistake: the store (saves), the poller and the sample route get it.
   */
  sourceHostAllowlist: SourceHostAllowlist;
  /**
   * BAJAOVRLAY_API_TOKENS as read at boot: the devices that may send commands over HTTP
   * (BAJAOVRLAY-28). Left out, the command API is off and answers 403.
   */
  apiTokens?: ApiTokens | undefined;
  /**
   * BAJAOVRLAY_API_OPEN as read at boot: the command API answers calls with no token,
   * signed `api:rede`, for a studio-only network. Left out: not open.
   */
  isApiOpenToTheNetwork?: boolean | undefined;
  /**
   * BAJAOVRLAY_PUBLIC_ORIGINS as read at boot: a reverse proxy's addresses whose pages may
   * upload images as well as the server's own. Left out: none (tests, the stream PC).
   */
  publicOrigins?: readonly string[] | undefined;
  /**
   * BAJAOVRLAY_OBS_URL and BAJAOVRLAY_OBS_PASSWORD as read at boot (BAJAOVRLAY-27). Left
   * out (no address): OBS control is off and the `obs` slice says `desligado`.
   */
  obsConnectionSettings?: ObsConnectionSettings | undefined;
  /**
   * BAJAOVRLAY_PIN_PRODUCER and BAJAOVRLAY_PIN_DATA as read at boot (BAJAOVRLAY-29). Left
   * out: the login off, every page open as before.
   */
  operatorPins?: OperatorPins | undefined;
  controlPageFolder?: string | undefined;
  rendererPageFolder?: string | undefined;
  /**
   * Where `pnpm build` leaves build-id.json (the id the built pages embed). Read once, at
   * boot: it names the build this process runs, which the hub sends in every hello so an
   * open page from another build reloads itself. Undefined, or no usable file: none sent.
   */
  buildIdFileUrl?: URL | undefined;
  /** Defaults to 15 s; tests use a few milliseconds. */
  heartbeatIntervalInMilliseconds?: number | undefined;
  /**
   * The server's clock; defaults to the server clock (core/time/serverClock.ts), which
   * never follows a step of the wall clock. One clock for the store (which stamps
   * commands and race clock readings), the WebSocket hub (which tells renderers what time
   * it is), the login and the triggers, so they can never disagree. Tests hold it still;
   * a test that hands one in also leaves NTP off.
   */
  readCurrentTime?: (() => Date) | undefined;
  /**
   * BAJAOVRLAY_NTP_SERVERS as read at boot (BAJAOVRLAY-62): the NTP servers the server
   * clock follows, or off. Left out: off, so no test ever waits on the internet; main.ts
   * always passes it.
   */
  ntpSettings?: NtpSettings | undefined;
  /**
   * BAJAOVRLAY_HTTP_TIME_SERVERS as read at boot (BAJAOVRLAY-76): the HTTPS servers whose
   * Date headers the server clock follows while NTP is quiet, or off. Left out: off.
   */
  httpTimeSettings?: HttpTimeSettings | undefined;
  /**
   * Where a backup copies the database before zipping it; the system's temporary folder
   * when left out. Tests give a folder of their own, so the sweep of copies left behind
   * at boot never meets another server's.
   */
  backupTemporaryFolder?: string | undefined;
};

/** A booted server: the port it listens on, its store, and how to stop it. */
export type RunningServer = {
  port: number;
  stateStore: StateStore;
  /** The build read from build-id.json at boot, sent in every hello; undefined when none. */
  buildId: string | undefined;
  /**
   * Stops polling data sources (calling off every poll in flight), calls off pending
   * auto-outs and a macro's pending wait, drops WebSocket clients, stops listening and
   * closes the database. Safe to call twice.
   */
  close: () => Promise<void>;
};

/**
 * Boots the whole server, in order: open the database and apply migrations (throws if
 * one fails, so the boot stops), load or seed the slices, start the server's own actors
 * (auto-out, macro runner, data-source poller), build the HTTP app, listen, and attach
 * the WebSocket hub to the same port. Rejects if any step fails.
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
  // Once, at boot, and never again: the id names the build this process runs. A
  // `pnpm build` with the server up writes a new id only once every package has built
  // (scripts/publishBuildId.js), and it takes effect at the restart, together with the
  // new server code; reading it per hello would send pages into a folder still being
  // written, or onto a bundle newer than the code answering it.
  const buildId =
    options.buildIdFileUrl === undefined ? undefined : readBuildId(options.buildIdFileUrl);
  const readCurrentTime = options.readCurrentTime ?? readServerTime;
  // The server clock follows NTP (BAJAOVRLAY-62): its first correction is a step, made
  // here, before the store reads the clock and before the server accepts a connection;
  // it waits up to 3 s for NTP, then starts on the wall clock and says so. Whether
  // anything on air counts time is read from the store, which does not exist yet; the
  // boot step never asks, and the first poll comes 16 s later. Until the store is there
  // the answer is "yes", so nothing could be stepped while the boot is still running.
  // After a step every page is sent the time at once, through the WebSocket hub, which
  // does not exist yet either: until it does there is no page to tell.
  const whatTheServerClockReadsLater: {
    readAllSlices: (() => Slices) | undefined;
    tellEveryPageOfAStep: (() => void) | undefined;
  } = { readAllSlices: undefined, tellEveryPageOfAStep: undefined };
  const serverClockControl: ServerClockControl =
    options.readCurrentTime === undefined && options.ntpSettings !== undefined
      ? startTheServerClockOnNtp({
          ntpSettings: options.ntpSettings,
          httpTimeSettings: options.httpTimeSettings ?? { isHttpTimeOn: false },
          serverClock: serverClockOfTheProcess,
          isAnythingCountingTimeOnAir: (stepByMs) =>
            whatTheServerClockReadsLater.readAllSlices === undefined ||
            isAnythingCountingTimeOnAnOutput(whatTheServerClockReadsLater.readAllSlices(), {
              nowMs: serverClockOfTheProcess.readCurrentTimeMs(),
              stepByMs,
            }),
          afterEachStep: () => whatTheServerClockReadsLater.tellEveryPageOfAStep?.(),
          logger: options.logger,
        })
      : serverClockWithNtpOff;
  await serverClockControl.stepToRealTimeAtBoot();
  const stateStore = createStateStore({
    database,
    logger: options.logger,
    graphicPackagesFolder: options.graphicPackagesFolder,
    recordingsFolder: buildRecordingsFolderPath(options.dataFolder),
    readCurrentTime,
    sourceHostAllowlist: options.sourceHostAllowlist,
  });
  // The login's signing key and open sessions are read from the database here, so the
  // sessions from before a restart still count (BAJAOVRLAY-29).
  const operatorLogin = createOperatorLogin({
    database,
    operatorPins: options.operatorPins ?? operatorLoginTurnedOff,
    readCurrentTime,
    logger: options.logger,
  });
  // Started before anything can send a command, so no take of an item with an
  // auto-out delay is missed. It holds no timer until such a take happens.
  const autoOutScheduler = startAutoOutScheduler({ stateStore, logger: options.logger });
  // Started before anything can send a command too, so no runMacro is missed.
  const macroRunner = startMacroRunner({ stateStore, logger: options.logger });
  // Started before the sources poll, so the first poll after a restart already refreshes
  // the bound fields of what was on air (BAJAOVRLAY-20).
  const bindingService = startBindingService({ stateStore, logger: options.logger });
  // Started before the sources poll too, so the first poll after a restart is seen as the
  // baseline and nothing that happened before it is replayed (BAJAOVRLAY-44).
  const eventInboxService = startEventInboxService({ stateStore, logger: options.logger });
  // After the macro runner, so a firing's run is carried out; before the sources poll and
  // OBS connects, so their first reports are the baseline and nothing before the boot
  // fires (BAJAOVRLAY-48). Its clock is the store's, so a schedule moment and a firing's
  // interval agree.
  const triggerService = startTriggerService({
    stateStore,
    logger: options.logger,
    readCurrentTime,
  });
  whatTheServerClockReadsLater.readAllSlices = stateStore.readAllSlices;
  // Sources left on before a restart start polling again at once; unlike a macro, a
  // source that is on is meant to keep running.
  const dataSourceService = startDataSourceService({
    stateStore,
    logger: options.logger,
    dataFolder: options.dataFolder,
    sourceHostAllowlist: options.sourceHostAllowlist,
  });
  // Creates DATA_DIR/media when missing, and removes the file of a deleted image.
  const mediaFolder = buildMediaFolderPath(options.dataFolder);
  const mediaService = startMediaService({ stateStore, mediaFolder, logger: options.logger });
  // Started after the macro runner, like the pollers: nothing waits for OBS, and an OBS
  // that is closed only leaves the slice in "erro" while the server tries again.
  const obsConnection =
    options.obsConnectionSettings === undefined
      ? undefined
      : startObsConnection({
          stateStore,
          logger: options.logger,
          settings: options.obsConnectionSettings,
        });
  /** Stops the server's own actors; used by close() and by a boot that fails from here. */
  function stopTheServerActors(): void {
    // Hanging up on OBS needs no waiting: nothing is sent to it after this.
    void obsConnection?.stop();
    mediaService.stop();
    dataSourceService.stop();
    bindingService.stop();
    eventInboxService.stop();
    triggerService.stop();
    autoOutScheduler.stop();
    macroRunner.stop();
    serverClockControl.stop();
  }

  // Clears the copies a server killed mid-backup left behind; nothing else runs until the
  // operator asks for a backup ("Cópia de segurança").
  const backupDownloads = createBackupDownloads({
    stateStore,
    logger: options.logger,
    databasePath: options.databasePath,
    dataFolder: options.dataFolder,
    version: options.version,
    readCurrentTime: options.readCurrentTime,
    temporaryFolder: options.backupTemporaryFolder,
  });

  let httpServer: Server;
  let webSocketHub: ReturnType<typeof attachWebSocketHub>;
  try {
    const app = createServerApp({
      logger: options.logger,
      version: options.version,
      stateStore,
      graphicPackagesFolder: options.graphicPackagesFolder,
      themeFolder: options.themeFolder,
      controlPageFolder: options.controlPageFolder,
      rendererPageFolder: options.rendererPageFolder,
      sourceHostAllowlist: options.sourceHostAllowlist,
      mediaFolder,
      apiTokens: options.apiTokens,
      isApiOpenToTheNetwork: options.isApiOpenToTheNetwork,
      publicOrigins: options.publicOrigins,
      backupDownloads,
      operatorLogin,
      serverClockControl,
    });
    httpServer = await listen({
      fetch: app.fetch,
      hostname: options.host,
      port: options.port,
    });
    webSocketHub = attachWebSocketHub({
      httpServer,
      stateStore,
      logger: options.logger,
      heartbeatIntervalInMilliseconds:
        options.heartbeatIntervalInMilliseconds ?? defaultHeartbeatIntervalInMilliseconds,
      readCurrentTime,
      readOffFromRealTimeMs: serverClockControl.readOffFromRealTimeMs,
      readServerClockSource: serverClockControl.readServerClockSource,
      buildId,
      operatorLogin,
      publicOrigins: options.publicOrigins,
    });
    whatTheServerClockReadsLater.tellEveryPageOfAStep = webSocketHub.sendTheTimeToEveryClientNow;
  } catch (bootError) {
    // The poller already armed a poll and a stale watch for every source left on: left
    // running, they would keep the process alive and send commands to the database that
    // startServer is about to close (for example when the port is already in use).
    stopTheServerActors();
    throw bootError;
  }

  async function closeEverything(): Promise<void> {
    // First, so no poll, auto-out or macro timer sends a command to a store whose
    // database is closing; a poll answering after this is dropped by the poller. A macro
    // stopped mid-run is not resumed at the next boot.
    stopTheServerActors();
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
    buildId,
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
