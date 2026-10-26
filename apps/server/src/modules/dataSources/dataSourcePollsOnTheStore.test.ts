/**
 * Data-source polls through the real store and its event log (apps/server)
 *
 * What this module is for:
 *   The poller sends recordDataSourcePoll every two seconds per source, through the
 *   same command path as every operator command. Logging each of those would bury the
 *   operator's history, so the store makes one deliberate exception (decision D11): a
 *   poll that leaves the source's health as it was is saved and broadcast, but writes
 *   no event-log row. A poll that changes nothing at all is a no-op, like any command.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - Ten routine good polls of a healthy source write no event-log row, yet the last
 *     snapshot is saved as the source's row of the data_snapshots table and listeners
 *     hear of the two slices it changed, without 'eventLog'.
 *   - The rows that are written are the operator's commands, the source going stale, a
 *     changed error and the recovery; repeated failures with the same error are not.
 *   - A poll that repeats the stored shapes on a healthy source leaves no trace: no row,
 *     no listener call, the very same arrays in memory.
 *   - A poll of a source deleted a moment ago is answered ok and leaves no trace either.
 *   - A logged poll row carries a trimmed payload, never the shapes: the recovery row of
 *     a 60-car poll holds the source, ok, the moment and the shape names alone, in under
 *     500 bytes of JSON, in memory and on disk; a refused poll is trimmed the same way,
 *     and one that fails validation keeps only its type and sourceId.
 *
 * What these tests deliberately do not cover:
 *   - Each reducer rule; reducers/recordDataSourcePoll.test.ts covers them.
 *   - The WebSocket broadcast itself; the hub sends what listeners are told (core/ws).
 */
import type { RecordDataSourcePollCommand, SliceName } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { readAllDataSnapshotRows } from '../../core/db/dataSnapshotRowStorage.js';
import { countEventLogRows, readNewestEventLogRows } from '../../core/db/eventLogRowStorage.js';
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { missingGraphicsFolderPath } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import { buildShapesFromRaceState } from './adapters/simulator/shapesFromRaceState.js';
import { simulateEnduroAt } from './adapters/simulator/simulateEnduro.js';
import { buildGreenFlagSessionAt } from './reducers/dataSourceSlices.testSupport.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const enduroSimulatorPollerActor = buildDataSourcePollerActor('simulador-enduro');
const startOfTheEnduroMs = Date.parse('2027-08-14T14:00:00.000Z');

/**
 * Opens a store on a new SQLite file (so the simulator "Simulador — Enduro" is seeded,
 * off) with a clock the test moves by hand, and turns the simulator on at 14:00.
 */
function openStoreWithTheEnduroSimulatorOn() {
  const { database } = openTemporaryDatabase();
  let momentTheClockShowsMs = startOfTheEnduroMs;
  const stateStore = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: missingGraphicsFolderPath,
    readCurrentTime: () => new Date(momentTheClockShowsMs),
  });
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
    operatorActor,
  );
  return {
    database,
    stateStore,
    moveTheClockTo: (momentMs: number) => {
      momentTheClockShowsMs = momentMs;
    },
  };
}

/** Builds the poller's good poll of the green-flag session, two seconds apart per index. */
function buildGoodPollNumber(pollNumber: number) {
  const receivedAtMs = startOfTheEnduroMs + pollNumber * 2_000;
  return {
    type: 'recordDataSourcePoll',
    sourceId: 'simulador-enduro',
    result: { ok: true, shapes: { session: buildGreenFlagSessionAt(receivedAtMs) }, receivedAtMs },
  };
}

/** Builds the poller's failed poll number `pollNumber`, with the given error. */
function buildFailedPollNumber(pollNumber: number, error: string) {
  return {
    type: 'recordDataSourcePoll',
    sourceId: 'simulador-enduro',
    result: { ok: false, error, attemptedAtMs: startOfTheEnduroMs + pollNumber * 2_000 },
  };
}

describe('routine polls of a healthy source', () => {
  it('write no event-log row over ten polls, yet save the snapshot and tell listeners', () => {
    // Arrange: the simulator on (one row: the operator's switch), a listener recording
    // the names of every change.
    const { database, stateStore } = openStoreWithTheEnduroSimulatorOn();
    const namesOfEachChange: SliceName[][] = [];
    stateStore.subscribeToSliceChanges((changedSliceNames) => {
      namesOfEachChange.push(changedSliceNames);
    });

    // Act: ten good polls, two seconds apart, each with a newer session.
    for (let pollNumber = 1; pollNumber <= 10; pollNumber += 1) {
      stateStore.applyCommand(buildGoodPollNumber(pollNumber), enduroSimulatorPollerActor);
    }

    // Assert: still one row; the tenth snapshot on disk; ten changes without 'eventLog'.
    const savedSnapshotRows = readAllDataSnapshotRows(database);
    expect(countEventLogRows(database), 'routine polls must write no event-log row').toBe(1);
    expect(
      savedSnapshotRows.map((row) => row.json),
      'the last snapshot must be saved all the same',
    ).toEqual([
      {
        sourceId: 'simulador-enduro',
        receivedAtMs: startOfTheEnduroMs + 20_000,
        shapes: { session: buildGreenFlagSessionAt(startOfTheEnduroMs + 20_000) },
      },
    ]);
    expect(namesOfEachChange, 'each poll is broadcast, without the event log').toEqual(
      Array.from({ length: 10 }, () => ['dataSources', 'dataSnapshots']),
    );
  });
});

describe("the rows a source's health writes", () => {
  it('logs going stale, a changed error and the recovery, and nothing for a repeat', () => {
    // Arrange: the simulator on, polled well once.
    const { database, stateStore } = openStoreWithTheEnduroSimulatorOn();
    stateStore.applyCommand(buildGoodPollNumber(1), enduroSimulatorPollerActor);

    // Act: three failures with one error, one with another, then a good poll.
    stateStore.applyCommand(
      buildFailedPollNumber(2, 'Falha simulada.'),
      enduroSimulatorPollerActor,
    );
    stateStore.applyCommand(
      buildFailedPollNumber(3, 'Falha simulada.'),
      enduroSimulatorPollerActor,
    );
    stateStore.applyCommand(
      buildFailedPollNumber(4, 'Falha simulada.'),
      enduroSimulatorPollerActor,
    );
    stateStore.applyCommand(
      buildFailedPollNumber(5, 'Tempo esgotado.'),
      enduroSimulatorPollerActor,
    );
    stateStore.applyCommand(buildGoodPollNumber(6), enduroSimulatorPollerActor);

    // Assert: the switch, going stale, the new error, the recovery: four rows.
    const loggedLines = stateStore
      .readAllSlices()
      .eventLog.map((entry) => `${entry.actor} ${entry.command}`);
    expect(countEventLogRows(database), 'only the health transitions are written').toBe(4);
    expect(loggedLines, 'the history must read switch, stale, new error, recovery').toEqual([
      `${operatorActor} setDataSourceEnabled`,
      `${enduroSimulatorPollerActor} recordDataSourcePoll`,
      `${enduroSimulatorPollerActor} recordDataSourcePoll`,
      `${enduroSimulatorPollerActor} recordDataSourcePoll`,
    ]);
  });
});

describe('a poll that changes nothing', () => {
  it('leaves no trace when it repeats the stored shapes of a healthy source', () => {
    // Arrange: the simulator on and polled well once; a listener counting changes.
    const { database, stateStore, moveTheClockTo } = openStoreWithTheEnduroSimulatorOn();
    stateStore.applyCommand(buildGoodPollNumber(1), enduroSimulatorPollerActor);
    const slicesBefore = stateStore.readAllSlices();
    const rowsBefore = countEventLogRows(database);
    let numberOfChangesHeard = 0;
    stateStore.subscribeToSliceChanges(() => {
      numberOfChangesHeard += 1;
    });

    // Act: two seconds later, a poll answers exactly the same session.
    moveTheClockTo(startOfTheEnduroMs + 4_000);
    const repeatedPoll = buildGoodPollNumber(1);
    const outcome = stateStore.applyCommand(
      {
        ...repeatedPoll,
        result: { ...repeatedPoll.result, receivedAtMs: startOfTheEnduroMs + 4_000 },
      },
      enduroSimulatorPollerActor,
    );

    // Assert: ok, no row, no listener, the very same arrays.
    const slicesAfter = stateStore.readAllSlices();
    expect(outcome, 'the poller still gets its ok').toEqual({ ok: true });
    expect(countEventLogRows(database), 'no row for a poll that changed nothing').toBe(rowsBefore);
    expect(numberOfChangesHeard, 'nothing must be broadcast').toBe(0);
    expect(slicesAfter.dataSnapshots, 'the snapshots must be untouched').toBe(
      slicesBefore.dataSnapshots,
    );
    expect(slicesAfter.dataSources, 'the sources must be untouched').toBe(slicesBefore.dataSources);
  });

  it('answers ok and leaves no trace for a source deleted a moment ago', () => {
    // Arrange: the simulator on, then deleted by the operator.
    const { database, stateStore } = openStoreWithTheEnduroSimulatorOn();
    stateStore.applyCommand(
      { type: 'deleteDataSource', sourceId: 'simulador-enduro' },
      operatorActor,
    );
    const rowsBefore = countEventLogRows(database);

    // Act: the poll that was in flight arrives.
    const outcome = stateStore.applyCommand(buildGoodPollNumber(1), enduroSimulatorPollerActor);

    // Assert: ok, and no refusal row.
    expect(outcome, 'a late poll must not be refused').toEqual({ ok: true });
    expect(countEventLogRows(database), 'a late poll must write no row').toBe(rowsBefore);
  });
});

/**
 * The poller's good poll number `pollNumber` with everything the simulator answers half
 * an hour into a 60-car enduro: the session, the positions and the overall standings.
 */
function buildGoodPollOfSixtyCarsNumber(pollNumber: number): RecordDataSourcePollCommand {
  const receivedAtMs = startOfTheEnduroMs + pollNumber * 2_000;
  const halfAnHourIntoTheRace = simulateEnduroAt(
    { seed: 2027, carCount: 60, sessionDurationMs: 4 * 60 * 60 * 1000 },
    30 * 60 * 1000,
  );
  return {
    type: 'recordDataSourcePoll',
    sourceId: 'simulador-enduro',
    result: {
      ok: true,
      shapes: buildShapesFromRaceState(halfAnHourIntoTheRace, receivedAtMs),
      receivedAtMs,
    },
  };
}

// A whole 60-car poll is tens of kilobytes; a trimmed row is a few hundred bytes.
const largestLoggedPollPayloadInBytes = 500;

describe('the payload of a logged poll row', () => {
  it('holds the source, ok, the moment and the shape names of a recovery, never the shapes', () => {
    // Arrange: the simulator on, polled well once, then failing once (it goes stale).
    const { database, stateStore } = openStoreWithTheEnduroSimulatorOn();
    stateStore.applyCommand(buildGoodPollNumber(1), enduroSimulatorPollerActor);
    stateStore.applyCommand(
      buildFailedPollNumber(2, 'Falha simulada.'),
      enduroSimulatorPollerActor,
    );

    // Act: a good poll with all 60 cars arrives, and the source recovers.
    const recoveryPoll = buildGoodPollOfSixtyCarsNumber(3);
    stateStore.applyCommand(recoveryPoll, enduroSimulatorPollerActor);

    // Assert: the recovery row's payload is the trimmed shape, small, in memory and on disk.
    const recoveryRow = stateStore.readAllSlices().eventLog.at(-1);
    const recoveryRowOnDisk = readNewestEventLogRows(database, 1)[0];
    const expectedPayload = {
      type: 'recordDataSourcePoll',
      sourceId: 'simulador-enduro',
      result: {
        ok: true,
        receivedAtMs: startOfTheEnduroMs + 6_000,
        shapeNames: ['session', 'positions', 'standings', 'incidents', 'brackets'],
      },
    };
    expect(
      JSON.stringify(recoveryPoll).length,
      'the poll itself must be big, or this test proves nothing',
    ).toBeGreaterThan(10_000);
    expect(recoveryRow?.payload, 'the row must name the shapes, not carry them').toEqual(
      expectedPayload,
    );
    expect(
      JSON.stringify(recoveryRow?.payload).length,
      `a logged poll row must stay under ${String(largestLoggedPollPayloadInBytes)} bytes`,
    ).toBeLessThan(largestLoggedPollPayloadInBytes);
    expect(recoveryRowOnDisk?.payload, 'the saved row must be trimmed the same way').toEqual(
      expectedPayload,
    );
  });

  it('keeps the error and the moment of a failed poll, which carries no shapes', () => {
    // Arrange: the simulator on and polled well once.
    const { stateStore } = openStoreWithTheEnduroSimulatorOn();
    stateStore.applyCommand(buildGoodPollNumber(1), enduroSimulatorPollerActor);

    // Act: a poll fails and the source goes stale.
    stateStore.applyCommand(
      buildFailedPollNumber(2, 'Tempo esgotado.'),
      enduroSimulatorPollerActor,
    );

    // Assert: the row says which source, that it failed, when, and why.
    expect(
      stateStore.readAllSlices().eventLog.at(-1)?.payload,
      'a failed poll row must keep its error and its moment',
    ).toEqual({
      type: 'recordDataSourcePoll',
      sourceId: 'simulador-enduro',
      result: { ok: false, attemptedAtMs: startOfTheEnduroMs + 4_000, error: 'Tempo esgotado.' },
    });
  });

  it('is trimmed the same way when the poll is refused', () => {
    // Arrange: the simulator on; the poller of another source, by a bug, sends its poll.
    const { stateStore } = openStoreWithTheEnduroSimulatorOn();
    const pollerOfAnotherSource = buildDataSourcePollerActor('reproducao-sexta');

    // Act: the 60-car poll of the simulator arrives under the wrong poller's name.
    const outcome = stateStore.applyCommand(
      buildGoodPollOfSixtyCarsNumber(1),
      pollerOfAnotherSource,
    );

    // Assert: refused, and its failed row carries no shapes either.
    expect(outcome, 'a poller may only report its own source').toMatchObject({ ok: false });
    expect(
      stateStore.readAllSlices().eventLog.at(-1)?.payload,
      'a refused poll row must name the shapes, not carry them',
    ).toEqual({
      type: 'recordDataSourcePoll',
      sourceId: 'simulador-enduro',
      result: {
        ok: true,
        receivedAtMs: startOfTheEnduroMs + 2_000,
        shapeNames: ['session', 'positions', 'standings', 'incidents', 'brackets'],
      },
    });
  });

  it('keeps only the type and the sourceId of a poll that fails validation', () => {
    // Arrange: a 60-car poll whose moment arrives as text, which the command schema refuses.
    const { stateStore } = openStoreWithTheEnduroSimulatorOn();
    const goodPoll = buildGoodPollOfSixtyCarsNumber(1);
    const malformedPoll = {
      ...goodPoll,
      result: { ...goodPoll.result, receivedAtMs: '2027-08-14T14:00:02.000Z' },
    };

    // Act: the malformed poll is sent.
    const outcome = stateStore.applyCommand(malformedPoll, enduroSimulatorPollerActor);

    // Assert: refused, and its failed row carries neither the shapes nor the rest of the result.
    expect(outcome, 'a poll with a moment as text must be refused').toMatchObject({ ok: false });
    expect(
      stateStore.readAllSlices().eventLog.at(-1)?.payload,
      'an invalid poll row must keep only its type and sourceId',
    ).toEqual({
      type: 'recordDataSourcePoll',
      sourceId: 'simulador-enduro',
      isResultLeftOut: true,
    });
  });
});
