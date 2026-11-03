/**
 * Turning on a replay, through the real poller, while its recording is read (apps/server)
 *
 * What this module is for:
 *   A recording of a 4-hour enduro takes about a second to read into memory. Turning its
 *   replay on must not make the operator see "Tempo esgotado" and a spurious "Atrasada":
 *   the poller prepares the replay as the source is turned on, so the read starts at
 *   once, and a poll called off while the read is still going records a clear
 *   "Carregando a gravação…" while the read carries on for the next poll (gate 2
 *   re-check on PR #16).
 *
 * What these tests prove (a real store on SQLite listing Friday's recording, the real
 * replay adapter and the real poller, with the poller's timers run by hand and a
 * recording reader the test ends by hand, so "before" and "after" the read are exact):
 *   - Turning the replay on starts reading the recording before any poll; a first poll
 *     that runs once the read has ended is good, and the source is not stale.
 *   - A first poll whose timeout fires while the recording is still being read is
 *     recorded as "Carregando a gravação…", never "Tempo esgotado"; once the read ends,
 *     the next poll answers and clears the source.
 *
 * What these tests deliberately do not cover:
 *   - How long a real file takes to read: that depends on the machine, so no test here
 *     races a read against a clock (BAJAOVRLAY-52). Reading a real file as a stream is
 *     adapters/replay/replayAdapterLoading.test.ts; its timings are measured by
 *     adapters/replay/replayLoading.benchmark.ts, which is not a CI gate.
 *   - Each rule of the replay's read and signal; adapters/replay/replayAdapterAbortSignal.test.ts.
 *   - When the poller prepares a source; pollerPreparesSources.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { createReplayAdapter } from './adapters/replay/replayAdapter.js';
import {
  createRecordingReaderFinishedByHand,
  fridayRecordingId,
  letPendingPromisesSettle,
  replayTurnedOnAtMs,
  writeFridayRecordingIntoAFolder,
} from './adapters/replay/replayAdapter.testSupport.js';
import { operatorActor } from './enduroSimulatorCommands.testSupport.js';
import { startDataSourcePoller } from './poller.js';
import { type CommandSentByThePoller, isPollResultCommand } from './poller.testSupport.js';
import type { PollResult } from './pollResultRecording.js';
import { createTimersRunByHand, openStoreOnTheDatabaseAndFolder } from './recorder.testSupport.js';

/** The label of the replay the operator makes of Friday's recording. */
const replayLabel = 'Reprodução — Treino de sexta';

/** The replay's poll interval, the default: also its poll timeout and its stale-watch wait. */
const pollIntervalMs = 2_000;

/**
 * A real store on a fresh database, its clock stopped at 15:00 on the enduro day,
 * listing Friday's recording and a replay of it at the default 2 s interval (off); the
 * real poller watching it through a spy on the commands it sends, with the real replay
 * adapter reading through a reader the test ends by hand, and timers the test runs by
 * hand.
 */
function startThePollerOnAReplayOfFridaysRecording() {
  const recordingsFolder = writeFridayRecordingIntoAFolder();
  const { database } = openTemporaryDatabase();
  const stateStore = openStoreOnTheDatabaseAndFolder(
    database,
    recordingsFolder,
    () => replayTurnedOnAtMs,
  );
  stateStore.applyCommand(
    {
      type: 'createDataSource',
      label: replayLabel,
      kind: 'replay',
      config: { recordingId: fridayRecordingId },
      pollIntervalMs,
    },
    operatorActor,
  );
  const replaySource = stateStore
    .readAllSlices()
    .dataSources.find((source) => source.label === replayLabel);
  if (replaySource === undefined) {
    throw new Error("the replay of Friday's recording must have been made");
  }
  const commandsSentByThePoller: CommandSentByThePoller[] = [];
  const storeSeenByThePoller: StateStore = {
    ...stateStore,
    applyCommand: (command, actor) => {
      commandsSentByThePoller.push({ command, actor });
      return stateStore.applyCommand(command, actor);
    },
  };
  const recordingReader = createRecordingReaderFinishedByHand();
  const timers = createTimersRunByHand();
  const poller = startDataSourcePoller({
    stateStore: storeSeenByThePoller,
    logger: createLogger({ level: 'silent' }),
    adapters: {
      replay: createReplayAdapter({
        recordingsFolder,
        readRecordingFile: recordingReader.readRecordingFile,
      }),
    },
    readCurrentTime: () => new Date(replayTurnedOnAtMs),
    startTimer: timers.startTimer,
    cancelTimer: timers.cancelTimer,
  });
  return {
    stateStore,
    poller,
    recordingReader,
    timers,
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

describe('turning on a replay while its recording is read', () => {
  it('starts reading at turn-on and records a good first poll once the read has ended, never "Tempo esgotado"', async () => {
    // Arrange: the poller on the replay of Friday's recording (off).
    const { stateStore, poller, recordingReader, timers, replaySourceId, readPollResults } =
      startThePollerOnAReplayOfFridaysRecording();

    // Act: the operator turns the replay on; the read ends before the first poll runs,
    // as it does when reading takes less than the 2 s timeout; then the first poll runs
    // and answers.
    turnTheReplayOn(stateStore, replaySourceId);
    const readsStartedBeforeAnyPoll = recordingReader.readRecordingIdsRead();
    recordingReader.finishTheOldestRead();
    await letPendingPromisesSettle();
    timers.runEveryDeferredTimer();
    await letPendingPromisesSettle();
    poller.stop();

    // Assert: the read started at turn-on, the one result is a good one, and the source
    // is fresh with no error.
    expect(
      readsStartedBeforeAnyPoll,
      'turning the replay on must start reading its recording before any poll runs',
    ).toEqual([fridayRecordingId]);
    expect(readPollResults(), 'the first poll must answer, not time out').toEqual([
      expect.objectContaining({ ok: true }),
    ]);
    expect(
      readTheReplayStatus(stateStore, replaySourceId),
      'a replay that just started must not read "Atrasada" or carry an error',
    ).toMatchObject({ isStale: false, lastError: null, consecutiveFailures: 0 });
  });

  it('records "Carregando a gravação…", not "Tempo esgotado", when a poll times out during the read, and the next poll answers', async () => {
    // Arrange: the poller on the replay of Friday's recording (off).
    const { stateStore, poller, recordingReader, timers, replaySourceId, readPollResults } =
      startThePollerOnAReplayOfFridaysRecording();

    // Act: the replay is turned on and its first poll starts; its 2 s timeout fires while
    // the recording is still being read. Then the read ends, the next poll's 2 s wait
    // ends, and that poll runs to its answer. (Each 2 s step also runs the stale watch,
    // which finds nothing overdue on a clock that stands still.)
    turnTheReplayOn(stateStore, replaySourceId);
    timers.runEveryDeferredTimer();
    timers.runEveryTimerOfDelay(pollIntervalMs);
    await letPendingPromisesSettle();
    const resultsWhileTheReadWasGoing = readPollResults();
    recordingReader.finishTheOldestRead();
    await letPendingPromisesSettle();
    timers.runEveryTimerOfDelay(pollIntervalMs);
    await letPendingPromisesSettle();
    poller.stop();

    // Assert: first a clear "loading" failure, then a good answer of Friday's cars from
    // the one read, and the source fresh again.
    expect(
      resultsWhileTheReadWasGoing,
      'a poll called off during the read must say the recording is loading, not that the source timed out',
    ).toEqual([expect.objectContaining({ ok: false, error: 'Carregando a gravação…' })]);
    expect(
      readPollResults()[1],
      'the next poll must answer from the read that carried on',
    ).toMatchObject({
      ok: true,
      shapes: { positions: { entries: expect.any(Array) as unknown } },
    });
    expect(
      recordingReader.readRecordingIdsRead(),
      'the recording must be read once, by the read the turn-on started',
    ).toEqual([fridayRecordingId]);
    expect(
      readTheReplayStatus(stateStore, replaySourceId),
      'the good poll must clear the loading failure',
    ).toMatchObject({ isStale: false, lastError: null, consecutiveFailures: 0 });
  });
});
