/**
 * Turning on a replay of a large recording, through the real poller (apps/server)
 *
 * What this module is for:
 *   A recording of a 4-hour enduro takes about a second to read into memory. Turning its
 *   replay on must not make the operator see "Tempo esgotado" and a spurious "Atrasada":
 *   the poller prepares the replay as the source is turned on, so the read starts at
 *   once, and a poll called off while the read is still going records a clear
 *   "Carregando a gravação…" while the read carries on for the next poll (gate 2
 *   re-check on PR #16).
 *
 * What these tests prove (a real store on SQLite listing a real 50 MB recording of 60
 * cars, the server's own adapters, the real poller):
 *   - With real timers and the default 2 s interval, turning the replay on records a good
 *     first poll, never a failure, and the source is not stale.
 *   - With the poller's timers run by hand, a first poll whose timeout fires while the
 *     recording is still being read is recorded as "Carregando a gravação…", never
 *     "Tempo esgotado", and the next poll answers the 60 cars and clears the source.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of the replay's read and signal; adapters/replay/replayAdapterAbortSignal.test.ts.
 *   - When the poller prepares a source; pollerPreparesSources.test.ts.
 *   - A whole 4-hour file (180 MB): writing it would cost the test itself seconds; the
 *     50 MB file reads in a few hundred ms, long after a timeout fired by hand.
 */
import { describe, expect, it, vi } from 'vitest';

import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { createDataSourceAdapters } from './adapters/createDataSourceAdapters.js';
import { enduroSimulatorId, operatorActor } from './enduroSimulatorCommands.testSupport.js';
import {
  fileNameOfTheLargeRecording,
  writeTheLargeRecordingInto,
} from './largeRecording.testSupport.js';
import { startDataSourcePoller } from './poller.js';
import { type CommandSentByThePoller, isPollResultCommand } from './poller.testSupport.js';
import type { PollResult } from './pollResultRecording.js';
import {
  createTemporaryRecordingsFolder,
  createTimersRunByHand,
  openStoreOnTheDatabaseAndFolder,
} from './recorder.testSupport.js';

/** The label of the replay the operator makes of the large recording. */
const replayLabel = 'Reprodução — Enduro longo';

/** How long a test waits for the 50 MB recording to be read: far above its usual 0,3 s. */
const longestWaitForTheReadMs = 10_000;

/**
 * A real store on a fresh database at the real time, listing the large recording, a
 * replay of it made at the default 2 s interval (off), and a spy on the commands the
 * poller sends.
 */
function prepareAStoreWithAReplayOfTheLargeRecording() {
  const recordingsFolder = createTemporaryRecordingsFolder();
  writeTheLargeRecordingInto(recordingsFolder);
  const { database } = openTemporaryDatabase();
  const stateStore = openStoreOnTheDatabaseAndFolder(database, recordingsFolder, () => Date.now());
  stateStore.applyCommand(
    {
      type: 'createDataSource',
      label: replayLabel,
      kind: 'replay',
      config: { recordingId: `${enduroSimulatorId}/${fileNameOfTheLargeRecording}` },
      pollIntervalMs: 2_000,
    },
    operatorActor,
  );
  const replaySource = stateStore
    .readAllSlices()
    .dataSources.find((source) => source.label === replayLabel);
  if (replaySource === undefined) {
    throw new Error('the replay of the large recording must have been made');
  }
  const commandsSentByThePoller: CommandSentByThePoller[] = [];
  const storeSeenByThePoller: StateStore = {
    ...stateStore,
    applyCommand: (command, actor) => {
      commandsSentByThePoller.push({ command, actor });
      return stateStore.applyCommand(command, actor);
    },
  };
  return {
    stateStore,
    storeSeenByThePoller,
    recordingsFolder,
    replaySourceId: replaySource.id,
    readPollResults: () =>
      commandsSentByThePoller
        .filter((sent) => isPollResultCommand(sent.command))
        .map((sent) => (sent.command as { result: PollResult }).result),
  };
}

/** The operator turns the replay on. */
function turnTheReplayOn(stateStore: StateStore, replaySourceId: string): void {
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: replaySourceId, isEnabled: true },
    operatorActor,
  );
}

/** The replay's status as the store holds it now. */
function readTheReplayStatus(stateStore: StateStore, replaySourceId: string) {
  const replaySource = stateStore
    .readAllSlices()
    .dataSources.find((source) => source.id === replaySourceId);
  if (replaySource === undefined) {
    throw new Error('the replay is missing from the store');
  }
  return replaySource.status;
}

/** Waits, in real time, until the poller has sent at least the given number of results. */
async function waitForPollResults(
  readPollResults: () => PollResult[],
  expectedCount: number,
): Promise<void> {
  await vi.waitFor(
    () => {
      expect(
        readPollResults().length,
        `the poller must have sent ${String(expectedCount)} poll result(s) within the wait`,
      ).toBeGreaterThanOrEqual(expectedCount);
    },
    { timeout: longestWaitForTheReadMs, interval: 20 },
  );
}

describe('turning on a replay of a large recording', () => {
  it('records a good first poll at the default 2 s interval, never "Tempo esgotado"', async () => {
    // Arrange: the store with the replay of the large recording (off), and the real
    // poller with the server's own adapters and real timers.
    const { stateStore, storeSeenByThePoller, recordingsFolder, replaySourceId, readPollResults } =
      prepareAStoreWithAReplayOfTheLargeRecording();
    const poller = startDataSourcePoller({
      stateStore: storeSeenByThePoller,
      logger: createLogger({ level: 'silent' }),
      adapters: createDataSourceAdapters({
        recordingsFolder,
        logger: createLogger({ level: 'silent' }),
      }),
    });

    // Act: the operator turns the replay on; wait for the first poll's result.
    turnTheReplayOn(stateStore, replaySourceId);
    await waitForPollResults(readPollResults, 1);
    poller.stop();

    // Assert: the first result is a good one, and the source is fresh with no error.
    const [firstResult] = readPollResults();
    expect(
      firstResult,
      'the first poll of a large recording must answer, not time out',
    ).toHaveProperty('ok', true);
    expect(
      readTheReplayStatus(stateStore, replaySourceId),
      'a replay that just started must not read "Atrasada" or carry an error',
    ).toMatchObject({ isStale: false, lastError: null, consecutiveFailures: 0 });
  });

  it('records "Carregando a gravação…", not "Tempo esgotado", when a poll times out during the read, and the next poll answers', async () => {
    // Arrange: the store with the replay (off), and the real poller with the server's own
    // adapters and timers the test runs by hand.
    const { stateStore, storeSeenByThePoller, recordingsFolder, replaySourceId, readPollResults } =
      prepareAStoreWithAReplayOfTheLargeRecording();
    const timers = createTimersRunByHand();
    const poller = startDataSourcePoller({
      stateStore: storeSeenByThePoller,
      logger: createLogger({ level: 'silent' }),
      adapters: createDataSourceAdapters({
        recordingsFolder,
        logger: createLogger({ level: 'silent' }),
      }),
      startTimer: timers.startTimer,
      cancelTimer: timers.cancelTimer,
    });

    // Act: the replay is turned on and its first poll starts; its 2 s timeout fires at
    // once, while the 50 MB recording is still being read. Then, once that result is in,
    // the next poll's 2 s wait ends and it runs to its answer.
    turnTheReplayOn(stateStore, replaySourceId);
    timers.runEveryDeferredTimer();
    timers.runEveryTimerOfDelay(2_000);
    await waitForPollResults(readPollResults, 1);
    timers.runEveryTimerOfDelay(2_000);
    await waitForPollResults(readPollResults, 2);
    poller.stop();

    // Assert: first a clear "loading" failure, then a good answer of the 60 cars, and the
    // source fresh again.
    const [firstResult, secondResult] = readPollResults();
    expect(
      firstResult,
      'a poll called off during the read must say the recording is loading, not that the source timed out',
    ).toMatchObject({ ok: false, error: 'Carregando a gravação…' });
    expect(secondResult, 'the next poll must answer from the read that carried on').toMatchObject({
      ok: true,
      shapes: { positions: { entries: expect.any(Array) as unknown } },
    });
    expect(
      readTheReplayStatus(stateStore, replaySourceId),
      'the good poll must clear the loading failure',
    ).toMatchObject({ isStale: false, lastError: null, consecutiveFailures: 0 });
  });
});
