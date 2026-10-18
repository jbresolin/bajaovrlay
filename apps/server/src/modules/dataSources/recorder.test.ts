/**
 * The recorder: a source's good polls written to a file while it records (apps/server)
 *
 * What this module is for:
 *   While a source records ("Gravar"), every poll the store accepts is appended as one
 *   JSON line `{ atMs, shapes }` to `<recordings folder>/<sourceId>/<start moment>.jsonl`,
 *   so the race can be replayed later (rehearsal mode). The data already on screen when
 *   "Gravar" is pressed is the first line. The store keeps the `recordings` list itself
 *   (decision D10); the recorder only mirrors the data to disk.
 *
 * What these tests prove (real store on a temporary SQLite file, real temporary folder):
 *   - The data the source already had is the first line, dated at "Gravar"; then one
 *     line per accepted poll, with the poll's moment and shapes; the file and the list
 *     count the same snapshots.
 *   - Data that never changes after "Gravar" is still recorded (its one line).
 *   - Two accepted polls dated at the same moment are two lines.
 *   - A poll that started before "Gravar" and answered after it is dated at "Gravar",
 *     never before the recording began.
 *   - No line for a poll that repeated the data, a failed poll, or another source's poll.
 *   - No line after the recording is closed: by "Parar gravação", by turning the source
 *     off (even once it is on again), or by deleting it.
 *
 * What these tests deliberately do not cover:
 *   - A write that fails, and stopping the recorder; recorderWhenAWriteFails.test.ts.
 *   - The recordings listed again after a restart; dataSourceRestart.test.ts.
 *   - The rules of the recordings slice (opened, counted, closed); the reducer tests
 *     startRecording, stopRecording and recordDataSourcePoll cover them.
 *   - The poller: these tests hand the store the poll results the poller would.
 */
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { StateStore } from '../../core/store/createStateStore.js';
import {
  enduroSimulatorId,
  operatorActor,
  startOfTheEnduroMs,
  turnTheSimulatorOff,
  turnTheSimulatorOn,
} from './enduroSimulatorCommands.testSupport.js';
import {
  deleteTheSimulator,
  fileNameOfTheRecordingStartedAt1400,
  listRecordingFilesOfSource,
  pressRecordOnTheSimulator,
  pressStopRecordingOnTheSimulator,
  readRecordedLines,
  readRecordedMomentsMs,
  readTheOnlyRecording,
  sendAFailedSimulatorPollAt,
  sendAGoodSimulatorPollAt,
  sendASimulatorPollOfTheSessionOf,
  startRecorderWatchingAStore,
} from './recorder.testSupport.js';
import { buildGreenFlagSessionAt } from './reducers/dataSourceSlices.testSupport.js';

const twoSecondsBefore = startOfTheEnduroMs - 2_000;
const twoSecondsIn = startOfTheEnduroMs + 2_000;
const fourSecondsIn = startOfTheEnduroMs + 4_000;
const sixSecondsIn = startOfTheEnduroMs + 6_000;

/** The path of the simulator's recording started at 14:00, in a recordings folder. */
function pathOfTheRecordingStartedAt1400(recordingsFolder: string): string {
  return join(recordingsFolder, enduroSimulatorId, fileNameOfTheRecordingStartedAt1400);
}

describe('the recorder, while a source records', () => {
  it('writes the data already there at "Gravar", then one line per accepted poll', () => {
    // Arrange: the simulator on, with the data of its poll at 13:59:58; "Gravar" at 14:00.
    const { stateStore, recordingsFolder } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    sendAGoodSimulatorPollAt(stateStore, twoSecondsBefore);
    pressRecordOnTheSimulator(stateStore);

    // Act: three good polls, two seconds apart.
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);
    sendAGoodSimulatorPollAt(stateStore, fourSecondsIn);
    sendAGoodSimulatorPollAt(stateStore, sixSecondsIn);

    // Assert: four lines in the file named after 14:00: the data of 13:59:58 dated at
    // "Gravar", then each poll as accepted; the store counts the same four snapshots.
    const recordingPath = pathOfTheRecordingStartedAt1400(recordingsFolder);
    expect(
      listRecordingFilesOfSource(recordingsFolder, enduroSimulatorId),
      'the recording must be one file named after the moment "Gravar" was pressed',
    ).toEqual([fileNameOfTheRecordingStartedAt1400]);
    expect(
      readRecordedLines(recordingPath),
      'the data on screen at "Gravar" must come first, then each accepted poll',
    ).toEqual([
      { atMs: startOfTheEnduroMs, shapes: { session: buildGreenFlagSessionAt(twoSecondsBefore) } },
      { atMs: twoSecondsIn, shapes: { session: buildGreenFlagSessionAt(twoSecondsIn) } },
      { atMs: fourSecondsIn, shapes: { session: buildGreenFlagSessionAt(fourSecondsIn) } },
      { atMs: sixSecondsIn, shapes: { session: buildGreenFlagSessionAt(sixSecondsIn) } },
    ]);
    expect(
      readTheOnlyRecording(stateStore).snapshotCount,
      'the file and the list must count the same snapshots',
    ).toBe(4);
  });

  it('records data that never changes after "Gravar"', () => {
    // Arrange: the simulator on, with the data of its poll at 13:59:58.
    const { stateStore, recordingsFolder, moveClockTo } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    sendAGoodSimulatorPollAt(stateStore, twoSecondsBefore);

    // Act: "Gravar" at 14:00; the same data comes back at 14:00:02; "Parar" at 14:00:05.
    pressRecordOnTheSimulator(stateStore);
    sendASimulatorPollOfTheSessionOf(stateStore, twoSecondsBefore, twoSecondsIn);
    moveClockTo(startOfTheEnduroMs + 5_000);
    pressStopRecordingOnTheSimulator(stateStore);

    // Assert: the file holds the one line written at "Gravar", so the recording can be
    // replayed and survives a restart.
    expect(
      readRecordedMomentsMs(pathOfTheRecordingStartedAt1400(recordingsFolder)),
      'data that did not change must still be in the recording, from the moment of "Gravar"',
    ).toEqual([startOfTheEnduroMs]);
    expect(readTheOnlyRecording(stateStore).snapshotCount, 'one snapshot must be counted').toBe(1);
  });

  it('writes two lines for two accepted polls dated at the same moment', () => {
    // Arrange: the simulator on and recording, with no data before "Gravar".
    const { stateStore, recordingsFolder } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);

    // Act: two good polls, both dated 14:00:02 (a server clock that did not move between
    // them), with different data.
    sendASimulatorPollOfTheSessionOf(stateStore, twoSecondsIn, twoSecondsIn);
    sendASimulatorPollOfTheSessionOf(stateStore, fourSecondsIn, twoSecondsIn);

    // Assert: two lines, as the store counts two snapshots.
    expect(
      readRecordedMomentsMs(pathOfTheRecordingStartedAt1400(recordingsFolder)),
      'each accepted poll is a line, even when two share a moment',
    ).toEqual([twoSecondsIn, twoSecondsIn]);
    expect(
      readTheOnlyRecording(stateStore).snapshotCount,
      'the file and the list must count the same snapshots',
    ).toBe(2);
  });

  it('dates at "Gravar" a poll that started before it and answered after it', () => {
    // Arrange: the simulator on, with no data yet; "Gravar" at 14:00.
    const { stateStore, recordingsFolder } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);

    // Act: a poll started at 13:59:58 answers now (a poll is dated when it started).
    sendAGoodSimulatorPollAt(stateStore, twoSecondsBefore);

    // Assert: written at 14:00, so the recording never ends before it began.
    expect(
      readRecordedMomentsMs(pathOfTheRecordingStartedAt1400(recordingsFolder)),
      'no line may be dated before the recording started',
    ).toEqual([startOfTheEnduroMs]);
  });

  it('writes no line for a poll that repeated the data, nor for a failed poll', () => {
    // Arrange: the simulator on and recording, with no data before "Gravar".
    const { stateStore, recordingsFolder } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);

    // Act: a good poll, the same data again two seconds later (a no-op), then a failure.
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);
    sendASimulatorPollOfTheSessionOf(stateStore, twoSecondsIn, fourSecondsIn);
    sendAFailedSimulatorPollAt(stateStore, sixSecondsIn);

    // Assert: only the first poll is in the file.
    expect(
      readRecordedMomentsMs(pathOfTheRecordingStartedAt1400(recordingsFolder)),
      'a repeat changes nothing in the store and a failure has no data, so neither is written',
    ).toEqual([twoSecondsIn]);
  });

  it('does not write a line again when another source gets new data', () => {
    // Arrange: the simulator on and recording, with one good poll written; a second
    // source, "Simulador — Treino", made and turned on.
    const { stateStore, recordingsFolder } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);
    stateStore.applyCommand(
      {
        type: 'createDataSource',
        label: 'Simulador — Treino',
        kind: 'simulator',
        config: {},
        pollIntervalMs: 2_000,
      },
      operatorActor,
    );
    const trainingSource = stateStore
      .readAllSlices()
      .dataSources.find((source) => source.label === 'Simulador — Treino');
    if (trainingSource === undefined) {
      throw new Error('the training source must have been made');
    }
    stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: trainingSource.id, isEnabled: true },
      operatorActor,
    );

    // Act: the training source gets a good poll of its own.
    stateStore.applyCommand(
      {
        type: 'recordDataSourcePoll',
        sourceId: trainingSource.id,
        result: {
          ok: true,
          shapes: { session: buildGreenFlagSessionAt(fourSecondsIn) },
          receivedAtMs: fourSecondsIn,
        },
      },
      `sistema:fonte:${trainingSource.id}`,
    );

    // Assert: the simulator's file still holds its one line, and the training source,
    // not recording, has no file.
    expect(
      readRecordedMomentsMs(pathOfTheRecordingStartedAt1400(recordingsFolder)),
      'the simulator snapshot did not change, so it must not be written twice',
    ).toEqual([twoSecondsIn]);
    expect(
      listRecordingFilesOfSource(recordingsFolder, trainingSource.id),
      'a source that is not recording must leave no file',
    ).toEqual([]);
  });
});

describe('the recorder, once a recording is closed', () => {
  const closingScenarios = [
    // The operator's own button. The next poll changes the snapshot while the closed
    // recording is still listed: the recorder itself must leave it alone.
    {
      name: 'writes nothing more after "Parar gravação"',
      closeTheRecording: pressStopRecordingOnTheSimulator,
    },
    // Turning a source off closes its recording. It is turned on again, so the next poll
    // really changes the snapshot: the recorder must not reopen the closed recording.
    {
      name: 'writes nothing more after the source is turned off, even once it is on again',
      closeTheRecording: (stateStore: StateStore) => {
        turnTheSimulatorOff(stateStore);
        turnTheSimulatorOn(stateStore);
      },
    },
    // Deleting the source closes it too; the file stays, ready to replay. The store drops
    // the poll of a deleted source (D8), so this row checks the whole path, not the
    // recorder alone: nothing reaches it.
    {
      name: 'writes nothing more after the source is deleted',
      closeTheRecording: deleteTheSimulator,
    },
  ];

  it.each(closingScenarios)('$name', ({ closeTheRecording }) => {
    // Arrange: the simulator on and recording, one good poll written.
    const { stateStore, recordingsFolder, moveClockTo } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);

    // Act: the recording is closed at 14:00:05, then a good poll arrives at 14:00:06.
    moveClockTo(startOfTheEnduroMs + 5_000);
    closeTheRecording(stateStore);
    sendAGoodSimulatorPollAt(stateStore, sixSecondsIn);

    // Assert: the file still holds the one line, and the list shows the recording closed.
    expect(
      readRecordedMomentsMs(pathOfTheRecordingStartedAt1400(recordingsFolder)),
      'nothing may be written once the recording is closed',
    ).toEqual([twoSecondsIn]);
    expect(
      readTheOnlyRecording(stateStore).endedAtMs,
      'the recording must be listed as closed at the moment it was closed',
    ).toBe(startOfTheEnduroMs + 5_000);
  });
});
