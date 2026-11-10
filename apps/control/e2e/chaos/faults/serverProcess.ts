// Test support (chaos suite): a real BajaOvrLay server a scenario starts, kills and starts
// again on the same data folder, as the stream PC runs it: the BUILT server
// (`node apps/server/dist/main.js`, what the Docker image runs), which serves the built
// control page and renderer itself, so a page opened on it needs no Vite and survives the
// server's death like a page on the stream PC does. Each scenario gets a data folder of its
// own under the gitignored apps/control/e2e-data-chaos, emptied when the scenario starts it
// for the first time. Nothing here is shared between scenarios.
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from '@playwright/test';

import { addressesOfTheProxies } from '../steps/chaosPorts';

// The repository root: the server reads its relative paths from where it is started.
const repoRootFolder = fileURLToPath(new URL('../../../../../', import.meta.url));
const builtServerEntry = 'apps/server/dist/main.js';
const chaosDataRootFolder = 'apps/control/e2e-data-chaos';

// The built server boots in about a second; 20 s before a clear message on a slow CI runner.
const waitForTheServerInMilliseconds = 20_000;

/** Settings a scenario adds to the server's environment (OBS, NTP, PINs...). */
export type ExtraServerSettings = Record<string, string>;

/** A server a scenario started: where it listens, and how to stop, kill or restart it. */
export type ChaosServer = {
  port: number;
  /** The absolute path of its data folder (DATA_DIR), where a scenario may put files. */
  dataFolder: string;
  /** `http://127.0.0.1:<port>`, where a page is opened when no proxy stands in between. */
  address: string;
  /** Stops it as Ctrl+C or `docker stop` does (SIGTERM), and waits until it has exited. */
  stop: () => Promise<void>;
  /** Kills it as a crash or a power cut of the process does (SIGKILL): no shutdown runs. */
  kill: () => Promise<void>;
  /** Starts it again on the same port, database and data folder; waits for /health. */
  startAgain: () => Promise<void>;
};

/** Answers whether /health answers ok on this port now; false while nothing listens. */
async function isHealthAnswering(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Starts the built server process and waits until /health answers. Fails at once, with
 * the reason, when the process exits before it answers (a port taken, a bad setting).
 */
async function startServerProcess(
  port: number,
  dataFolder: string,
  extraSettings: ExtraServerSettings,
): Promise<ChildProcess> {
  let howItEnded: string | undefined;
  const serverProcess = spawn(process.execPath, [builtServerEntry], {
    cwd: repoRootFolder,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      LOG_LEVEL: 'warn',
      DATABASE_PATH: `${dataFolder}/chaos.sqlite`,
      DATA_DIR: dataFolder,
      // No NTP unless the scenario points it at a fake one: never the internet in a test.
      BAJAOVRLAY_NTP_SERVERS: 'off',
      // Pages opened through a connection proxy may open the console's WebSocket.
      BAJAOVRLAY_PUBLIC_ORIGINS: addressesOfTheProxies,
      ...extraSettings,
    },
  });
  serverProcess.on('error', (spawnError) => {
    howItEnded = `it could not be started: ${spawnError.message}`;
  });
  serverProcess.on('exit', (exitCode, signal) => {
    howItEnded = `it exited (code ${String(exitCode)}, signal ${String(signal)})`;
  });
  await expect
    .poll(
      async () => {
        if (howItEnded !== undefined) {
          return `the chaos server ended before /health answered: ${howItEnded}`;
        }
        return (await isHealthAnswering(port)) ? 'answering' : 'not yet';
      },
      { message: 'the chaos server must answer /health', timeout: waitForTheServerInMilliseconds },
    )
    .toBe('answering');
  return serverProcess;
}

/** Sends a signal to the process and waits until it has exited; nothing if it already has. */
async function endServerProcess(serverProcess: ChildProcess, signal: NodeJS.Signals) {
  const hasAlreadyExited = serverProcess.exitCode !== null || serverProcess.signalCode !== null;
  if (hasAlreadyExited) {
    return;
  }
  const exited = once(serverProcess, 'exit');
  serverProcess.kill(signal);
  await exited;
}

/**
 * Starts a server for one scenario on `port`, on a new, empty data folder named after the
 * scenario, with any extra settings it needs. The caller stops it in a `finally`.
 * What could go wrong: the folder is deleted first, so the name must be the scenario's own.
 */
export async function startChaosServer(
  scenarioFolderName: string,
  port: number,
  extraSettings: ExtraServerSettings = {},
): Promise<ChaosServer> {
  const dataFolder = `${chaosDataRootFolder}/${scenarioFolderName}`;
  const absoluteDataFolder = `${repoRootFolder}${dataFolder}`;
  rmSync(absoluteDataFolder, { recursive: true, force: true });
  mkdirSync(absoluteDataFolder, { recursive: true });
  let serverProcess = await startServerProcess(port, dataFolder, extraSettings);

  return {
    port,
    dataFolder: absoluteDataFolder,
    address: `http://127.0.0.1:${String(port)}`,
    stop: () => endServerProcess(serverProcess, 'SIGTERM'),
    kill: () => endServerProcess(serverProcess, 'SIGKILL'),
    startAgain: async () => {
      await endServerProcess(serverProcess, 'SIGTERM');
      serverProcess = await startServerProcess(port, dataFolder, extraSettings);
    },
  };
}
