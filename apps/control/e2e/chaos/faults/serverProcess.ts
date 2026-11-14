// Test support (chaos suite): a real BajaOvrLay server a scenario starts, kills and starts
// again on the same data folder, as the stream PC runs it: the BUILT server
// (`node apps/server/dist/main.js`, what the Docker image runs), which serves the built
// control page and renderer itself, so a page opened on it needs no Vite and survives the
// server's death like a page on the stream PC does. Each scenario gets a data folder of its
// own under the gitignored apps/control/e2e-data-chaos, emptied when the scenario starts it
// for the first time. Scenarios start servers through the test-scoped fixture of
// steps/chaosTest.ts, which kills every one when the scenario ends, however it ends, and
// attaches what each server wrote to the scenario's report.
//
// What could go wrong: a server left running holds the chaos ports, and every scenario
// after it fails to start. So a server whose /health never answers is killed before the
// start fails, and every server still running when the worker's Node exits is killed then.
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

// Every server process this worker started and that has not exited yet.
const serverProcessesStillRunning = new Set<ChildProcess>();
// A worker that crashes or is stopped runs this on its way out: no server outlives it.
process.on('exit', () => {
  for (const serverProcess of serverProcessesStillRunning) {
    serverProcess.kill('SIGKILL');
  }
});

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
  /** Everything every process of it wrote on stderr, and on stdout, start by start. */
  readWhatItWrote: () => { stderr: string; stdout: string };
};

/** What the processes of one chaos server wrote, kept in order, a header per start. */
type WhatTheServerWrote = { stderr: string[]; stdout: string[] };

/** Answers whether /health answers ok on this port now; false while nothing listens. */
async function isHealthAnswering(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/** Sends a signal to the process and waits until it has exited; nothing if it already has. */
async function endServerProcess(
  serverProcess: ChildProcess,
  signal: NodeJS.Signals,
): Promise<void> {
  const hasAlreadyExited = serverProcess.exitCode !== null || serverProcess.signalCode !== null;
  if (hasAlreadyExited) {
    return;
  }
  const exited = once(serverProcess, 'exit');
  serverProcess.kill(signal);
  await exited;
}

/**
 * Starts the built server process and waits until /health answers. Its stderr and stdout
 * are kept (read as they come, so a full pipe never stalls the server). Fails, with the
 * reason, when the process exits before it answers (a port taken, a bad setting), and
 * kills it first when it never answers, so a failed start leaves nothing running.
 */
async function startServerProcess(
  port: number,
  dataFolder: string,
  extraSettings: ExtraServerSettings,
  whatItWrote: WhatTheServerWrote,
): Promise<ChildProcess> {
  let howItEnded: string | undefined;
  const serverProcess = spawn(process.execPath, [builtServerEntry], {
    cwd: repoRootFolder,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      LOG_LEVEL: 'warn',
      DATABASE_PATH: `${dataFolder}/chaos.sqlite`,
      DATA_DIR: dataFolder,
      // No NTP unless the scenario points it at a fake one: never the internet in a test.
      BAJAOVRLAY_NTP_SERVERS: 'off',
      // Nor HTTPS Date headers, NTP's fallback (BAJAOVRLAY-76): never the internet.
      BAJAOVRLAY_HTTP_TIME_SERVERS: 'off',
      // Pages opened through a connection proxy may open the console's WebSocket.
      BAJAOVRLAY_PUBLIC_ORIGINS: addressesOfTheProxies,
      ...extraSettings,
    },
  });
  serverProcessesStillRunning.add(serverProcess);
  const startHeader = `--- server started at ${new Date().toISOString()} ---\n`;
  whatItWrote.stderr.push(startHeader);
  whatItWrote.stdout.push(startHeader);
  serverProcess.stderr?.on('data', (chunk: Buffer) => whatItWrote.stderr.push(chunk.toString()));
  serverProcess.stdout?.on('data', (chunk: Buffer) => whatItWrote.stdout.push(chunk.toString()));
  serverProcess.on('error', (spawnError) => {
    howItEnded = `it could not be started: ${spawnError.message}`;
  });
  serverProcess.on('exit', (exitCode, signal) => {
    serverProcessesStillRunning.delete(serverProcess);
    howItEnded = `it exited (code ${String(exitCode)}, signal ${String(signal)})`;
  });
  try {
    await expect
      .poll(
        async () => {
          if (howItEnded !== undefined) {
            return `the chaos server ended before /health answered: ${howItEnded}`;
          }
          return (await isHealthAnswering(port)) ? 'answering' : 'not yet';
        },
        {
          message: 'the chaos server must answer /health',
          timeout: waitForTheServerInMilliseconds,
        },
      )
      .toBe('answering');
  } catch (startFailure) {
    await endServerProcess(serverProcess, 'SIGKILL');
    throw startFailure;
  }
  return serverProcess;
}

/**
 * Starts a server for one scenario on `port`, on a new, empty data folder named after the
 * scenario, with any extra settings it needs. Scenarios call it through the fixture of
 * steps/chaosTest.ts, never directly, so the server is killed when the scenario ends.
 * What could go wrong: the folder is deleted first, so the name must be the scenario's own.
 */
export async function startChaosServerProcess(
  scenarioFolderName: string,
  port: number,
  extraSettings: ExtraServerSettings = {},
): Promise<ChaosServer> {
  const dataFolder = `${chaosDataRootFolder}/${scenarioFolderName}`;
  const absoluteDataFolder = `${repoRootFolder}${dataFolder}`;
  rmSync(absoluteDataFolder, { recursive: true, force: true });
  mkdirSync(absoluteDataFolder, { recursive: true });
  const whatItWrote: WhatTheServerWrote = { stderr: [], stdout: [] };
  let serverProcess = await startServerProcess(port, dataFolder, extraSettings, whatItWrote);

  return {
    port,
    dataFolder: absoluteDataFolder,
    address: `http://127.0.0.1:${String(port)}`,
    stop: () => endServerProcess(serverProcess, 'SIGTERM'),
    kill: () => endServerProcess(serverProcess, 'SIGKILL'),
    startAgain: async () => {
      await endServerProcess(serverProcess, 'SIGTERM');
      serverProcess = await startServerProcess(port, dataFolder, extraSettings, whatItWrote);
    },
    readWhatItWrote: () => ({
      stderr: whatItWrote.stderr.join(''),
      stdout: whatItWrote.stdout.join(''),
    }),
  };
}
