/**
 * The event inbox across a server restart, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Step 5 of BAJAOVRLAY-44's walk: a server restarted mid-race must not replay the
 *   events it had already listed, nor list as news what happened while it was down (the
 *   first poll after a boot is a baseline). The other browser tests share one server
 *   Playwright starts and cannot restart, so this file starts a server of its own, exactly
 *   as `pnpm dev` runs it, on its own port and SQLite file, stops it and starts it again
 *   on the same file.
 *
 * What these tests prove:
 *   - With the simulator at 60× on seed 227, the server lists the race's first penalty.
 *     After a restart and two more good polls, every event listed before the restart is
 *     still there with its own moment, no event is listed twice, and every event added
 *     since was detected after the restart: the race moved on for several simulated
 *     minutes meanwhile, and none of it came back as news.
 *   The simulator is turned off just before the restart, so the list read then is final
 *   (a poll between the read and the stop would add a genuine event and fail the test for
 *   nothing), and on again after the boot, as an operator would.
 *
 * What these tests deliberately do not cover:
 *   - The baseline of the first poll after a boot with the source left on: the server's
 *     eventDetectionOnTheStore.test.ts proves it, on a clock it moves by hand.
 *   - The page: this test talks to its server as the page does (a WebSocket of its own,
 *     GET /api/v1/state); eventInboxWithTheSimulator.e2e.ts drives the console.
 *   - Which detector found what: the server's own tests.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';

import { expect, test } from '@playwright/test';

import {
  type InboxEventAsTheTestsReadIt,
  readInboxStateOfTheServerOnPort,
  sendCommandOrFail,
} from './eventInboxOnTheRealServer';

/** This file's own server: away from the shared one (5187) and the page (5188). */
const ownServerPort = 5189;

// Read from the repository root, in the throwaway folder playwright.config.ts empties
// before every run, so each run starts on a new database.
const ownDatabasePath = 'apps/control/e2e-data/eventInboxAfterARestart.sqlite';
const ownDataFolder = 'apps/control/e2e-data/eventInboxAfterARestart';

// Booting from the TypeScript source takes a few seconds on CI; 30 s before a clear message.
const waitForTheServerInMilliseconds = 30_000;
const waitForThePenaltyInMilliseconds = 30_000;
const longestThisTestMayTakeInMilliseconds = 120_000;

/**
 * Starts the server from its source as `pnpm dev` does, in a process group of its own so
 * stopping it stops tsx and Node with it, and waits until /health answers.
 */
async function startOwnServer(): Promise<ChildProcess> {
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
  await expect
    .poll(
      async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${String(ownServerPort)}/health`);
          return response.ok;
        } catch {
          return false;
        }
      },
      { message: 'the own server must answer /health', timeout: waitForTheServerInMilliseconds },
    )
    .toBe(true);
  return serverProcess;
}

/** Stops the server's whole process group, as Ctrl+C does, and waits for it to exit. */
async function stopOwnServer(serverProcess: ChildProcess): Promise<void> {
  const exited = once(serverProcess, 'exit');
  if (serverProcess.pid !== undefined) {
    process.kill(-serverProcess.pid, 'SIGTERM');
  }
  await exited;
}

/** The moment the own server's simulator last delivered a good poll, or 0. */
async function readLastGoodPollMoment(): Promise<number> {
  const state = await readInboxStateOfTheServerOnPort(ownServerPort);
  return (
    state.dataSnapshots.find((snapshot) => snapshot.sourceId === 'simulador-enduro')
      ?.receivedAtMs ?? 0
  );
}

test.describe('the event inbox across a restart', () => {
  test('replays nothing it listed before, and lists nothing twice', async () => {
    test.setTimeout(longestThisTestMayTakeInMilliseconds);

    // Arrange: the own server, its simulator on seed 227 at 60×, read every 0,5 s, its race
    // started now; wait for the first penalty to be listed.
    let serverProcess = await startOwnServer();
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

    // Act: turn the simulator off and keep what was listed; restart the server on the same
    // file; turn the simulator on again and wait for two good polls (the baseline, then one
    // compared with it).
    await sendCommandOrFail(ownServerPort, {
      type: 'setDataSourceEnabled',
      sourceId: 'simulador-enduro',
      isEnabled: false,
    });
    const eventsBeforeTheRestart = (await readInboxStateOfTheServerOnPort(ownServerPort)).events;
    await stopOwnServer(serverProcess);
    const restartedAtMs = Date.now();
    serverProcess = await startOwnServer();
    try {
      await sendCommandOrFail(ownServerPort, {
        type: 'setDataSourceEnabled',
        sourceId: 'simulador-enduro',
        isEnabled: true,
      });
      await expect
        .poll(readLastGoodPollMoment, {
          message: 'the simulator must poll again after the restart',
          timeout: waitForTheServerInMilliseconds,
        })
        .toBeGreaterThan(restartedAtMs + 1_000);
      const eventsAfterTheRestart: InboxEventAsTheTestsReadIt[] = (
        await readInboxStateOfTheServerOnPort(ownServerPort)
      ).events;

      // Assert: the events of before are there as they were (their status may have moved
      // on: a queued one shown or expired since), none listed twice, and every new one
      // detected after the restart.
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
      const eventIdsBefore = new Set(eventsBeforeTheRestart.map((event) => event.eventId));
      const eventsAddedSince = eventsAfterTheRestart.filter(
        (event) => !eventIdsBefore.has(event.eventId),
      );
      for (const addedEvent of eventsAddedSince) {
        expect(
          addedEvent.detectedAtMs,
          `${addedEvent.eventId} must have been detected after the restart, not replayed`,
        ).toBeGreaterThan(restartedAtMs);
      }
    } finally {
      await stopOwnServer(serverProcess);
    }
  });
});
