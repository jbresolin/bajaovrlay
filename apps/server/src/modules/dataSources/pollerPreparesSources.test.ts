/**
 * The data-source poller: preparing a source before it is polled (apps/server)
 *
 * What this module is for:
 *   Some sources need slow work before they can answer, such as a replay reading a
 *   recording of a whole enduro into memory. An adapter may offer prepareForPolling for
 *   that work, and the poller calls it when a source's loop starts and whenever the
 *   source's config changes, so the work starts at once instead of inside a poll, where
 *   it would run into the poll's timeout (gate 2 re-check on PR #16).
 *
 * What these tests prove (fake clock and timers from 14:00, a real store on SQLite, a
 * hand-written fake simulator that notes each call in order):
 *   - Turning a source on prepares it with its config before its first poll.
 *   - A source left on across a restart is prepared at boot, before its first poll.
 *   - Editing the config prepares the source again, with the new config, before the next
 *     poll; an edit or a press that leaves the config as it was does not.
 *   - An adapter whose prepareForPolling throws (a bug) is logged and still polled.
 *
 * What these tests deliberately do not cover:
 *   - What the replay does when prepared; adapters/replay/replayAdapterAbortSignal.test.ts.
 *   - A replay of a large recording polled through the poller;
 *     replayPollingWhileLoading.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  enduroSimulatorId,
  operatorActor,
  turnTheSimulatorOn,
} from './enduroSimulatorCommands.testSupport.js';
import {
  countPollResults,
  createSimulatorAdapterThatNotesItsPreparations,
  pressPollNowOnTheSimulator,
  setTheSimulatorPollInterval,
  startPollerWatchingTheStore,
} from './poller.testSupport.js';

/** The operator edits the simulator's config ("Editar"), giving it another seed. */
function setTheSimulatorSeed(stateStore: StateStore, seed: number): void {
  stateStore.applyCommand(
    { type: 'updateDataSource', sourceId: enduroSimulatorId, config: { seed } },
    operatorActor,
  );
}

/** The operator renames the simulator ("Editar", the label only). */
function renameTheSimulator(stateStore: StateStore): void {
  stateStore.applyCommand(
    { type: 'updateDataSource', sourceId: enduroSimulatorId, label: 'Simulador — Treino' },
    operatorActor,
  );
}

describe('preparing a source when its loop starts', () => {
  it('prepares a source with its config when it is turned on, before its first poll', async () => {
    // Arrange: the poller watching the store, the simulator off.
    const fakeSimulator = createSimulatorAdapterThatNotesItsPreparations();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
    });

    // Act: the operator turns the simulator on, and the first poll's timer fires.
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Assert: prepared once, with the seeded seed, and only then read.
    expect(
      fakeSimulator.readCallsInOrder(),
      'turning a source on must prepare it before its first poll',
    ).toEqual(['preparou a semente 2027', 'leu a fonte']);
  });

  it('prepares a source left on across a restart at boot, before its first poll', async () => {
    // Arrange: the simulator on in the store before the poller starts, as after a restart.
    const fakeSimulator = createSimulatorAdapterThatNotesItsPreparations();
    startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
      isSimulatorLeftOnAcrossARestart: true,
    });

    // Act: the first poll's timer fires.
    await vi.advanceTimersByTimeAsync(0);

    // Assert: prepared at boot, then read.
    expect(
      fakeSimulator.readCallsInOrder(),
      'a source left on must be prepared at boot, before its first poll',
    ).toEqual(['preparou a semente 2027', 'leu a fonte']);
  });
});

describe('preparing a source again when its config changes', () => {
  it('prepares the source with the new config when the config is edited, before the next poll', async () => {
    // Arrange: the simulator on and polled once.
    const fakeSimulator = createSimulatorAdapterThatNotesItsPreparations();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
    });
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Act: the operator gives the simulator seed 7, and the next poll comes 2 s later.
    setTheSimulatorSeed(stateStore, 7);
    await vi.advanceTimersByTimeAsync(2_000);

    // Assert: prepared again with seed 7 at the edit, before the next read.
    expect(
      fakeSimulator.readCallsInOrder(),
      'an edited config must be prepared at once, before the next poll reads it',
    ).toEqual(['preparou a semente 2027', 'leu a fonte', 'preparou a semente 7', 'leu a fonte']);
  });

  const changesThatLeaveTheConfigAsItWas = [
    // A new label is not a new source to read.
    { name: 'renaming the source', changeTheSource: renameTheSimulator },
    // A new interval restarts the rhythm (and polls at once), but reads the same source.
    {
      name: 'changing its poll interval',
      changeTheSource: (stateStore: StateStore) => setTheSimulatorPollInterval(stateStore, 1_000),
    },
    // "Atualizar agora" polls at once; the source is already prepared.
    { name: 'pressing "Atualizar agora"', changeTheSource: pressPollNowOnTheSimulator },
    // A good poll changes the source's status, never its config.
    { name: 'a good poll being recorded', changeTheSource: () => undefined },
  ];

  it.each(changesThatLeaveTheConfigAsItWas)(
    'does not prepare the source again for $name',
    async ({ changeTheSource }) => {
      // Arrange: the simulator on and polled once (a good poll recorded).
      const fakeSimulator = createSimulatorAdapterThatNotesItsPreparations();
      const { stateStore, readCommandsSentByThePoller } = startPollerWatchingTheStore({
        adapters: { simulator: fakeSimulator.adapter },
      });
      turnTheSimulatorOn(stateStore);
      await vi.advanceTimersByTimeAsync(0);

      // Act: the change, then four more seconds of polling.
      changeTheSource(stateStore);
      await vi.advanceTimersByTimeAsync(4_000);

      // Assert: polled again, but prepared only the once, when it was turned on.
      const preparations = fakeSimulator
        .readCallsInOrder()
        .filter((call) => call.startsWith('preparou'));
      expect(
        countPollResults(readCommandsSentByThePoller()),
        'the source must have kept being polled',
      ).toBeGreaterThan(1);
      expect(
        preparations,
        'a change that leaves the config as it was must not prepare the source again',
      ).toEqual(['preparou a semente 2027']);
    },
  );
});

describe('an adapter whose preparation throws', () => {
  it('logs the error and still polls the source', async () => {
    // Arrange: a simulator whose prepareForPolling throws (a bug: it must not), and a
    // logger that keeps its lines.
    const fakeSimulator = createSimulatorAdapterThatNotesItsPreparations();
    fakeSimulator.makeItsPreparationThrow('preparação quebrada');
    const { logger, readRecordedLines } = createRecordingLogger();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
      logger,
    });

    // Act: the operator turns the simulator on, and the first poll's timer fires.
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Assert: the error is logged with the source's id, and the source is read anyway.
    const errorLines = readRecordedLines().filter((line) => line.level === 'error');
    expect(
      errorLines.map((line) => [line.message, line.source_id]),
      'a preparation that throws must be logged as an error naming the source',
    ).toEqual([['data source preparation crashed', enduroSimulatorId]]);
    expect(
      fakeSimulator.readCallsInOrder(),
      'a preparation that throws must not stop the source from being polled',
    ).toEqual(['preparou a semente 2027', 'leu a fonte']);
  });
});
