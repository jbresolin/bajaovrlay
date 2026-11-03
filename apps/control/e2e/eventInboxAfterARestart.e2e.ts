/**
 * The event inbox across a server restart, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Step 5 of BAJAOVRLAY-44's walk: a server restarted mid-race must not replay what it
 *   had already listed. Since gate 2 of PR #22 (João's call) what happened while it was
 *   down does arrive: the detection starts from the last snapshot saved. The other browser
 *   tests share one server Playwright starts and cannot restart, so this file starts a
 *   server of its own, exactly as `pnpm dev` runs it, on its own port and SQLite file,
 *   stops it and starts it again on the same file, the simulator left on throughout.
 *
 * What these tests prove:
 *   - With the simulator at 60× on seed 227, the server lists the race's first penalty.
 *     After a restart, once a poll strictly later than the first one after the boot has
 *     been compared, no event detected after the last poll before the stop (a moment on
 *     the server's clock) repeats an incident or a fastest lap (car and lap, in the same
 *     race) listed before it, no event is listed twice, and every event listed before is
 *     still there with its own moment. The first server is gone, every process of it,
 *     before the second starts.
 *
 * What these tests deliberately do not cover:
 *   - The page: this test talks to its server as the page does (a WebSocket of its own,
 *     GET /api/v1/state); eventInboxWithTheSimulator.e2e.ts drives the console.
 *   - Which detector found what, and the arrival of what happened during the downtime
 *     (the race moves on at 60×, so whether something happens in those seconds is luck):
 *     the server's eventDetectionOnTheStore.test.ts proves both on a clock it moves by hand.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';

import { expect, test } from '@playwright/test';

import { portOffsetOfTheBrowserTests } from './emptyTheServerState';
import {
  type InboxEventAsTheTestsReadIt,
  readInboxStateOfTheServerOnPort,
  sendCommandOrFail,
  type StateTheInboxTestsRead,
} from './eventInboxOnTheRealServer';

/**
 * This file's own server: away from the shared one (5187) and the page (5188), moved with
 * them by BAJAOVRLAY_E2E_PORT_OFFSET so two checkouts can run their browser tests at once.
 */
const ownServerPort = 5189 + portOffsetOfTheBrowserTests;

// Read from the repository root, in the throwaway folder playwright.config.ts empties
// before every run, so each run starts on a new database.
const ownDatabasePath = 'apps/control/e2e-data/eventInboxAfterARestart.sqlite';
const ownDataFolder = 'apps/control/e2e-data/eventInboxAfterARestart';

// Booting from the TypeScript source takes a few seconds on CI; 30 s before a clear message.
const waitForTheServerInMilliseconds = 30_000;
const waitForThePenaltyInMilliseconds = 30_000;
const waitForAPollInMilliseconds = 15_000;
const longestThisTestMayTakeInMilliseconds = 150_000;

/** A server this test started: its process, and how it ended if it has. */
type OwnServer = { serverProcess: ChildProcess; readHowItEnded: () => string | undefined };

/** Answers whether /health answers ok now; false when nothing listens yet. */
async function isHealthAnswering(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(ownServerPort)}/health`);
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
async function startOwnServer(): Promise<OwnServer> {
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
        PORT: String(ownServerPort),
        HOST: '127.0.0.1',
        LOG_LEVEL: 'warn',
        DATABASE_PATH: ownDatabasePath,
        DATA_DIR: ownDataFolder,
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
        return (await isHealthAnswering()) ? 'answering' : 'not yet';
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
async function stopOwnServer(ownServer: OwnServer): Promise<void> {
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

/** The moment, on the server's clock, the simulator last delivered a good poll, or 0. */
function readLastGoodPollMomentOfState(state: StateTheInboxTestsRead): number {
  return (
    state.dataSnapshots.find((snapshot) => snapshot.sourceId === 'simulador-enduro')
      ?.receivedAtMs ?? 0
  );
}

/** The moment the own server's simulator last delivered a good poll, read now, or 0. */
async function readLastGoodPollMoment(): Promise<number> {
  return readLastGoodPollMomentOfState(await readInboxStateOfTheServerOnPort(ownServerPort));
}

/**
 * The race (session) a fastest lap was set in, read from its event id, which the server
 * writes as `<sourceId>:fastestLap:<sessionId>:<carNumber>:<lap>` (newFastestLap.ts);
 * neither the source id nor the session id holds a ':'.
 */
function readSessionOfAFastestLap(event: InboxEventAsTheTestsReadIt): string {
  const [, , sessionId] = event.eventId.split(':');
  return sessionId ?? '';
}

/**
 * What an event is about, in words the test compares: the incident (its id names its
 * race), or the car's lap in its race. The race counts: seed 227 runs the same race
 * every time it restarts, so car 39's first lap is the fastest in every one of them,
 * and the same lap in another race is another happening, not a repeat. Compared by car
 * and lap alone, the new race's lap, detected after the restart, read as a repeat of
 * the one an earlier race listed (once under load; BAJAOVRLAY-52).
 */
function describeWhatTheEventIsAbout(event: InboxEventAsTheTestsReadIt): string {
  if (event.kind === 'fastestLap') {
    return `fastestLap race ${readSessionOfAFastestLap(event)} car ${String(event.payload.carNumber)} lap ${String(event.payload.lapNumber)}`;
  }
  return event.eventId;
}

test.describe('the event inbox across a restart', () => {
  test('repeats nothing it listed before, and lists nothing twice', async () => {
    test.setTimeout(longestThisTestMayTakeInMilliseconds);
    let ownServer: OwnServer | undefined;
    try {
      // Arrange: the own server, its simulator on seed 227 at 60×, read every 0,5 s, its
      // race started now; wait for the first penalty to be listed.
      ownServer = await startOwnServer();
      await sendCommandOrFail(ownServerPort, {
        type: 'updateDataSource',
        sourceId: 'simulador-enduro',
        pollIntervalMs: 500,
        config: { seed: 227, speed: 60 },
      });
      await sendCommandOrFail(ownServerPort, {
        type: 'setDataSourceEnabled',
        sourceId: 'simulador-enduro',
        isEnabled: true,
      });
      await sendCommandOrFail(ownServerPort, {
        type: 'restartSimulatedRace',
        sourceId: 'simulador-enduro',
      });
      await expect
        .poll(
          async () =>
            (await readInboxStateOfTheServerOnPort(ownServerPort)).events.some(
              (event) => event.kind === 'newIncident',
            ),
          { message: 'the first penalty must be listed', timeout: waitForThePenaltyInMilliseconds },
        )
        .toBe(true);

      // Act: read what is listed and, in the same read, the server's moment of its last
      // poll; restart the server with the simulator still on, and wait for the first poll
      // after the boot and then one strictly later (compared with it). Every moment
      // compared is the server's own (gate 2 of PR #25): the test's clock is never one.
      const stateBeforeTheRestart = await readInboxStateOfTheServerOnPort(ownServerPort);
      const eventsBeforeTheRestart = stateBeforeTheRestart.events;
      const lastPollBeforeTheStopMs = readLastGoodPollMomentOfState(stateBeforeTheRestart);
      await stopOwnServer(ownServer);
      ownServer = await startOwnServer();
      await expect
        .poll(readLastGoodPollMoment, {
          message: 'the simulator must poll after the boot',
          timeout: waitForAPollInMilliseconds,
        })
        .toBeGreaterThan(lastPollBeforeTheStopMs);
      const firstPollAfterTheBootMs = await readLastGoodPollMoment();
      await expect
        .poll(readLastGoodPollMoment, {
          message: 'the simulator must poll once more after its first poll since the boot',
          timeout: waitForAPollInMilliseconds,
        })
        .toBeGreaterThan(firstPollAfterTheBootMs);
      const eventsAfterTheRestart = (await readInboxStateOfTheServerOnPort(ownServerPort)).events;

      // Assert: none listed twice; everything listed before still there with its moment;
      // nothing detected since repeats an incident or a lap listed before the restart.
      const eventIdsAfter = eventsAfterTheRestart.map((event) => event.eventId);
      expect(new Set(eventIdsAfter).size, 'no event may be listed twice').toBe(
        eventIdsAfter.length,
      );
      for (const eventBefore of eventsBeforeTheRestart) {
        const sameEventAfter = eventsAfterTheRestart.find(
          (event) => event.eventId === eventBefore.eventId,
        );
        expect(
          sameEventAfter?.detectedAtMs,
          `${eventBefore.eventId} must still be listed with its own moment`,
        ).toBe(eventBefore.detectedAtMs);
      }
      const whatWasListedBefore = new Set(eventsBeforeTheRestart.map(describeWhatTheEventIsAbout));
      const eventsDetectedSinceTheRestart = eventsAfterTheRestart.filter(
        (event) => event.detectedAtMs > lastPollBeforeTheStopMs,
      );
      for (const eventSince of eventsDetectedSinceTheRestart) {
        expect(
          whatWasListedBefore.has(describeWhatTheEventIsAbout(eventSince)),
          `${eventSince.eventId} repeats something listed before the restart`,
        ).toBe(false);
      }
    } finally {
      if (ownServer !== undefined) {
        await stopOwnServer(ownServer);
      }
    }
  });
});
