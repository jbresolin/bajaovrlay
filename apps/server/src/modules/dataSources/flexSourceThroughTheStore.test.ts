/**
 * A flex HTTP/JSON source through the store, recorded and replayed (apps/server)
 *
 * What this module is for:
 *   A flex source is a source like any other: the operator makes it ("+ Fonte"), turns
 *   it on, the poller reads the timing system and the store keeps canonical shapes as its
 *   snapshot; "Gravar" records those polls, and a replay of the recording answers the
 *   same shapes later, moved onto the replay's timeline, as for the simulator.
 *
 * What these tests prove (a real store on a temporary SQLite file, the real poller with
 * Node's timers, the real recorder writing to a temporary folder, the server's own
 * adapters, and a real HTTP server on 127.0.0.1 standing in for the timing system):
 *   - The example preset made through createDataSource, turned on and polled, leaves the
 *     20 fictional cars and the session in the store, in the canonical shapes, the
 *     positions dated at the poll's moment.
 *   - Recording that source and replaying the recording gives the same positions and
 *     session, dated at the replay's moment, the session clock moved by the same hour.
 *
 * What these tests deliberately do not cover:
 *   - Each mapping rule and transform: packages/shared/src/flexMapping and transforms.
 *   - Each fetch failure and its pt-BR error: adapters/httpJson/*.test.ts.
 *   - The poller's rhythm and the replay's timeline: poller*.test.ts, adapters/replay.
 */
import type { DataSnapshot, DataSource } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { createDataSourceAdapters } from './adapters/createDataSourceAdapters.js';
import {
  readExampleConfigPointedAt,
  readExampleTimingSystemResponse,
  startTimingSystemTestServer,
} from './adapters/httpJson/timingSystemTestServer.testSupport.js';
import { operatorActor, startOfTheEnduroMs } from './enduroSimulatorCommands.testSupport.js';
import { startDataSourcePoller } from './poller.js';
import { readTheOnlyRecording, startRecorderWatchingAStore } from './recorder.testSupport.js';

/** One hour after the start of the enduro: when the replay is made and turned on. */
const oneHourLaterMs = startOfTheEnduroMs + 60 * 60 * 1_000;

/**
 * Starts the store and the recorder at 14:00 on a clock the test moves, and the real
 * poller on that same clock with the server's own adapters (stopped after the test).
 */
function startStoreRecorderAndPollerAtTwoPm() {
  const { stateStore, recordingsFolder, moveClockTo } = startRecorderWatchingAStore();
  const clock = { nowMs: startOfTheEnduroMs };
  const logger = createLogger({ level: 'silent' });
  const poller = startDataSourcePoller({
    stateStore,
    logger,
    adapters: createDataSourceAdapters({ recordingsFolder, logger }),
    readCurrentTime: () => new Date(clock.nowMs),
  });
  onTestFinished(() => poller.stop());
  return {
    stateStore,
    moveBothClocksTo: (momentMs: number) => {
      clock.nowMs = momentMs;
      moveClockTo(momentMs);
    },
  };
}

/** Reads the source with this label as the store holds it now; fails the test if absent. */
function readSourceLabelled(stateStore: StateStore, label: string): DataSource {
  const source = stateStore.readAllSlices().dataSources.find((each) => each.label === label);
  if (source === undefined) {
    throw new Error(`the source "${label}" must have been made`);
  }
  return source;
}

/** Waits (up to five seconds) for the source's snapshot to be in the store, and reads it. */
async function waitForTheSnapshotOf(stateStore: StateStore, sourceId: string) {
  return vi.waitFor(
    () => {
      const snapshot = stateStore
        .readAllSlices()
        .dataSnapshots.find((each) => each.sourceId === sourceId);
      if (snapshot === undefined) {
        throw new Error(`no snapshot of ${sourceId} yet`);
      }
      return snapshot;
    },
    { timeout: 5_000, interval: 20 },
  );
}

/** The operator turns a source on or off. */
function switchTheSource(stateStore: StateStore, sourceId: string, isEnabled: boolean): void {
  stateStore.applyCommand({ type: 'setDataSourceEnabled', sourceId, isEnabled }, operatorActor);
}

/**
 * Makes "Cronometragem — Enduro", the example preset pointed at the test timing system,
 * polled once a minute (so the test sees one poll), turns it on and presses "Gravar" at
 * once, before its first poll runs. Gives back the source and its first snapshot.
 */
async function makeTheFlexSourceAndRecordItsFirstPoll(stateStore: StateStore, baseUrl: string) {
  stateStore.applyCommand(
    {
      type: 'createDataSource',
      label: 'Cronometragem — Enduro',
      kind: 'httpJson',
      config: readExampleConfigPointedAt(`${baseUrl}/cronometragem/classificacao`),
      pollIntervalMs: 60_000,
    },
    operatorActor,
  );
  const flexSource = readSourceLabelled(stateStore, 'Cronometragem — Enduro');
  switchTheSource(stateStore, flexSource.id, true);
  stateStore.applyCommand({ type: 'startRecording', sourceId: flexSource.id }, operatorActor);
  const flexSnapshot = await waitForTheSnapshotOf(stateStore, flexSource.id);
  return { flexSource, flexSnapshot };
}

/** The flex snapshot's shapes, read without a missing shape passing silently. */
function readPositionsAndSession(snapshot: DataSnapshot) {
  const { positions, session } = snapshot.shapes;
  if (positions === undefined || session === undefined) {
    throw new Error('the snapshot must hold positions and session');
  }
  return { positions, session };
}

describe('a flex source through the store', () => {
  it('stores the canonical shapes of the timing system once it is turned on', async () => {
    // Arrange: the fictional timing system answering its classification, and the store,
    // recorder and poller at 14:00.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { stateStore } = startStoreRecorderAndPollerAtTwoPm();

    // Act: make the flex source from the example preset, turn it on and let the poller
    // read it once.
    const { flexSource, flexSnapshot } = await makeTheFlexSourceAndRecordItsFirstPoll(
      stateStore,
      timingSystem.baseUrl,
    );

    // Assert: 20 cars in race order, the leader car 17 of "Acauã Baja", the positions
    // dated at the poll; the session of the enduro; the source healthy.
    const { positions, session } = readPositionsAndSession(flexSnapshot);
    expect(positions.entries.length, 'all 20 fictional cars must be in the positions').toBe(20);
    expect(
      positions.entries.map((entry) => entry.position),
      'the places must be 1 to 20 in the order the timing system lists them',
    ).toEqual(Array.from({ length: 20 }, (_unused, index) => index + 1));
    expect(positions.entries[0], 'the leader must be car 17, "Acauã Baja", on track').toMatchObject(
      { carNumber: 17, teamName: 'Acauã Baja', schoolName: 'Mauá', status: 'running' },
    );
    expect(
      positions.updatedAtMs,
      'the positions must be dated at the moment of the poll, 14:00',
    ).toBe(startOfTheEnduroMs);
    expect(session, 'the session must be the enduro under green').toMatchObject({
      sessionId: 'enduro-2027-nacional',
      sessionKind: 'enduro',
      state: 'green',
    });
    expect(
      readSourceLabelled(stateStore, 'Cronometragem — Enduro').status,
      'the flex source must be healthy after a good poll',
    ).toMatchObject({ isStale: false, lastError: null });
    expect(flexSnapshot.sourceId, 'the snapshot must belong to the flex source').toBe(
      flexSource.id,
    );
  });

  it('replays a recording of the flex source with the same shapes, moved to the replay', async () => {
    // Arrange: the flex source made, on and recorded from 14:00, one good poll recorded,
    // then the recording stopped at 14:00:05 and the source turned off.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { stateStore, moveBothClocksTo } = startStoreRecorderAndPollerAtTwoPm();
    const { flexSource, flexSnapshot } = await makeTheFlexSourceAndRecordItsFirstPoll(
      stateStore,
      timingSystem.baseUrl,
    );
    moveBothClocksTo(startOfTheEnduroMs + 5_000);
    stateStore.applyCommand({ type: 'stopRecording', sourceId: flexSource.id }, operatorActor);
    switchTheSource(stateStore, flexSource.id, false);
    const recording = readTheOnlyRecording(stateStore);

    // Act: at 15:00, make a replay of that recording, turn it on and let the poller read it.
    moveBothClocksTo(oneHourLaterMs);
    stateStore.applyCommand(
      {
        type: 'createDataSource',
        label: 'Reprodução — Cronometragem das 14h',
        kind: 'replay',
        config: { recordingId: recording.id },
        pollIntervalMs: 500,
      },
      operatorActor,
    );
    const replaySource = readSourceLabelled(stateStore, 'Reprodução — Cronometragem das 14h');
    switchTheSource(stateStore, replaySource.id, true);
    const replaySnapshot = await waitForTheSnapshotOf(stateStore, replaySource.id);

    // Assert: the replay holds the very cars and session the flex source stored, dated
    // 15:00, with the session clock showing at 15:00 what it showed at 14:00.
    const recorded = readPositionsAndSession(flexSnapshot);
    const replayed = readPositionsAndSession(replaySnapshot);
    expect(
      replayed.positions,
      'the replayed positions must be the recorded ones, dated at the replay',
    ).toEqual({ ...recorded.positions, updatedAtMs: oneHourLaterMs });
    expect(
      replayed.session,
      'the replayed session must be the recorded one, its clock moved by the hour between',
    ).toEqual({
      ...recorded.session,
      updatedAtMs: oneHourLaterMs,
      clock: {
        ...recorded.session.clock,
        referenceWallClockMs:
          recorded.session.clock.referenceWallClockMs + (oneHourLaterMs - startOfTheEnduroMs),
      },
    });
  });
});
