/**
 * Recording a source and replaying it, through a real store (apps/server)
 *
 * What this module is for:
 *   The rehearsal mode of concept §7 rule 8 in one go: the operator records a source
 *   ("Gravar"), stops, makes a replay source of that recording and turns it on; the
 *   replay then answers what was recorded, at the moment it was recorded, as a live
 *   source would.
 *
 * What these tests prove (a real store on a temporary SQLite file, the real recorder
 * writing to a temporary folder, the server's own adapters):
 *   - A replay of a recording made through the store answers, at each moment after it
 *     is turned on, the positions recorded that long after the recording's first line
 *     (not after "Gravar"), and the store takes that answer as the replay's snapshot.
 *
 * What these tests deliberately do not cover:
 *   - The poller's rhythm: the test polls the adapter itself, at chosen moments.
 *   - Each rule of the recorder and of the timeline; recorder.test.ts and
 *     adapters/replay/*.test.ts cover them.
 */
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { createDataSourceAdapters } from './adapters/createDataSourceAdapters.js';
import { buildTwoCarPositions } from './adapters/replay/fridayTraining.testSupport.js';
import {
  enduroSimulatorId,
  operatorActor,
  startOfTheEnduroMs,
  turnTheSimulatorOn,
} from './enduroSimulatorCommands.testSupport.js';
import {
  fileNameOfTheRecordingStartedAt1400,
  pressRecordOnTheSimulator,
  pressStopRecordingOnTheSimulator,
  startRecorderWatchingAStore,
} from './recorder.testSupport.js';

/** The simulator's poller hands the store good positions, car 42 the given gap behind. */
function sendSimulatorPositionsAt(
  stateStore: StateStore,
  receivedAtMs: number,
  gapOfCar42Ms: number,
): void {
  stateStore.applyCommand(
    {
      type: 'recordDataSourcePoll',
      sourceId: enduroSimulatorId,
      result: {
        ok: true,
        shapes: { positions: buildTwoCarPositions({ updatedAtMs: receivedAtMs, gapOfCar42Ms }) },
        receivedAtMs,
      },
    },
    buildDataSourcePollerActor(enduroSimulatorId),
  );
}

describe('a recording replayed through the store', () => {
  it('answers the recorded positions at the moment they were recorded', async () => {
    // Arrange: the simulator recorded from 14:00 to 14:00:07, three polls two seconds
    // apart with car 42 falling back (1.2 s, 2.5 s, 3.1 s behind); then a replay source
    // of that recording, made and turned on at 15:00.
    const { stateStore, recordingsFolder, moveClockTo } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    sendSimulatorPositionsAt(stateStore, startOfTheEnduroMs + 2_000, 1_200);
    sendSimulatorPositionsAt(stateStore, startOfTheEnduroMs + 4_000, 2_500);
    sendSimulatorPositionsAt(stateStore, startOfTheEnduroMs + 6_000, 3_100);
    moveClockTo(startOfTheEnduroMs + 7_000);
    pressStopRecordingOnTheSimulator(stateStore);
    const replayTurnedOnAtMs = Date.parse('2027-08-14T15:00:00.000Z');
    moveClockTo(replayTurnedOnAtMs);
    stateStore.applyCommand(
      {
        type: 'createDataSource',
        label: 'Reprodução — Enduro das 14h',
        kind: 'replay',
        config: { recordingId: `${enduroSimulatorId}/${fileNameOfTheRecordingStartedAt1400}` },
        pollIntervalMs: 1_000,
      },
      operatorActor,
    );
    const replaySource = stateStore
      .readAllSlices()
      .dataSources.find((source) => source.label === 'Reprodução — Enduro das 14h');
    if (replaySource === undefined) {
      throw new Error('the replay source must have been made');
    }
    stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: replaySource.id, isEnabled: true },
      operatorActor,
    );
    const replayAdapter = createDataSourceAdapters({
      recordingsFolder,
      logger: createLogger({ level: 'silent' }),
    }).replay;
    const replayTurnedOn = stateStore
      .readAllSlices()
      .dataSources.find((source) => source.id === replaySource.id);
    if (replayAdapter === undefined || replayTurnedOn?.kind !== 'replay') {
      throw new Error('the server must have a replay adapter and the replay must be on');
    }

    // Act: the replay is polled 1 s and 4.5 s after it was turned on (the first line is
    // 14:00:02, so these replay 14:00:03 and 14:00:06.5), and the second answer is
    // handed to the store as the replay's poller would.
    const pollAt = (nowMs: number) =>
      replayAdapter.pollOnce(replayTurnedOn.config, {
        readCurrentTime: () => new Date(nowMs),
        signal: new AbortController().signal,
      });
    const answerAfterOneSecond = await pollAt(replayTurnedOnAtMs + 1_000);
    const answerAfterFourAndAHalfSeconds = await pollAt(replayTurnedOnAtMs + 4_500);
    const storeOutcome = stateStore.applyCommand(
      {
        type: 'recordDataSourcePoll',
        sourceId: replaySource.id,
        result: {
          ok: true,
          shapes: answerAfterFourAndAHalfSeconds.shapes,
          receivedAtMs: replayTurnedOnAtMs + 4_500,
        },
      },
      buildDataSourcePollerActor(replaySource.id),
    );

    // Assert: 1 s in, the first recorded positions; 4.5 s in, the third; dated now; and
    // the store took the replay's answer as its snapshot.
    expect(
      answerAfterOneSecond.shapes.positions,
      'one second in, the replay must answer what was recorded one second after the first poll',
    ).toEqual(
      buildTwoCarPositions({ updatedAtMs: replayTurnedOnAtMs + 1_000, gapOfCar42Ms: 1_200 }),
    );
    expect(
      answerAfterFourAndAHalfSeconds.shapes.positions,
      'four and a half seconds in, the replay must answer the third recorded poll',
    ).toEqual(
      buildTwoCarPositions({ updatedAtMs: replayTurnedOnAtMs + 4_500, gapOfCar42Ms: 3_100 }),
    );
    expect(storeOutcome, 'the store must accept the replay answer').toEqual({ ok: true });
    const replaySnapshot = stateStore
      .readAllSlices()
      .dataSnapshots.find((snapshot) => snapshot.sourceId === replaySource.id);
    expect(
      replaySnapshot?.shapes.positions?.entries[1]?.gapToLeaderMs,
      'the replay snapshot must hold the recorded gap of car 42',
    ).toBe(3_100);
  });
});
