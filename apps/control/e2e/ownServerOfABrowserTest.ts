// Test support: a real server a browser test starts and stops itself, away from the shared one
// (5187), when the test needs what the shared one cannot give: a restart on the same SQLite
// file (eventInboxAfterARestart.e2e.ts), or an NTP server of the test's own whose time the
// test moves (plainSponsorRollEveryFiveMinutes.e2e.ts). Moved here from the restart test,
// its first user, by BAJAOVRLAY-64. Each call starts a new process; nothing is shared.
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';

import { expect } from '@playwright/test';

// Booting from the TypeScript source takes a few seconds on CI; 30 s before a clear message.
const waitForTheServerInMilliseconds = 30_000;

/** A server a test started: its process, and how it ended if it has. */
export type OwnServer = { serverProcess: ChildProcess; readHowItEnded: () => string | undefined };

/** Where the own server listens and keeps its data, and the settings it boots with. */
export type OwnServerSettings = {
  port: number;
  /** Read from the repository root; under apps/control/e2e-data, emptied before every run. */
  databasePath: string;
  dataFolder: string;
  /** More of the server's variables, such as BAJAOVRLAY_NTP_SERVERS. */
  moreVariables?: Record<string, string>;
};

/** Answers whether /health answers ok now on this port; false when nothing listens yet. */
async function isHealthAnswering(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Starts the server from its source as `pnpm dev` does, in a process group of its own so
 * stopping it stops tsx and Node with it, and waits until /health answers. Fails at once,
 * saying so, when the process cannot be started or exits before /health answers.
 */
export async function startOwnServer(settings: OwnServerSettings): Promise<OwnServer> {
  let howItEnded: string | undefined;
  const serverProcess = spawn(
    'pnpm',
    [
      '--filter',
      '@bajaovrlay/server',
      'exec',
      'tsx',
      '--conditions=@bajaovrlay/source',
      'src/main.ts',
    ],
    {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: String(settings.port),
        HOST: '127.0.0.1',
        LOG_LEVEL: 'warn',
        DATABASE_PATH: settings.databasePath,
        DATA_DIR: settings.dataFolder,
        ...settings.moreVariables,
      },
    },
  );
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
          return `the own server ended before /health answered: ${howItEnded}`;
        }
        return (await isHealthAnswering(settings.port)) ? 'answering' : 'not yet';
      },
      { message: 'the own server must answer /health', timeout: waitForTheServerInMilliseconds },
    )
    .toBe('answering');
  return { serverProcess, readHowItEnded: () => howItEnded };
}

/** Answers whether any process of a process group is still alive (signal 0 sends nothing). */
function isAnyProcessOfTheGroupAlive(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stops the server's whole process group, as Ctrl+C does, and waits until every process of
 * it has exited. Why not only the spawned process: it is the pnpm wrapper, which can exit
 * before the Node server under tsx has closed its port and its SQLite file; the next server
 * would then start beside a server still shutting down, on the same port and file (gate 2
 * of PR #25). The group is empty only once that Node server itself is gone.
 */
export async function stopOwnServer(ownServer: OwnServer): Promise<void> {
  const { serverProcess } = ownServer;
  if (ownServer.readHowItEnded() !== undefined || serverProcess.pid === undefined) {
    return;
  }
  const processGroupId = serverProcess.pid;
  const wrapperExited = once(serverProcess, 'exit');
  process.kill(-processGroupId, 'SIGTERM');
  await wrapperExited;
  await expect
    .poll(() => isAnyProcessOfTheGroupAlive(processGroupId), {
      message: 'every process of the own server (pnpm, tsx and Node) must have exited',
      timeout: waitForTheServerInMilliseconds,
    })
    .toBe(false);
}
