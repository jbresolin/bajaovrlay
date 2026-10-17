/**
 * Cleared fields and fields stamped by the server, through the store (apps/server)
 *
 * What this module is for:
 *   The control page never reads its own clock and never sends a cleared field to a
 *   graphic. An item stores a cleared field as a literal `null` and a wall-clock field
 *   left to the take as `takeTime`; an update names the fields the server must stamp
 *   (`takeTimeFieldKeys`) and sends a cleared field as `null`. The store reads the clock
 *   once per command, and that one moment becomes the stamped field's value, the
 *   instance's `takenAt` (on a take) and the event-log row's time.
 *
 * What these tests prove (with a real SQLite file and the race clock's real data schema):
 *   - A take of an item with a cleared lap count and the reference moment left to the
 *     take goes on air with the take's milliseconds and no lap count; the event log
 *     keeps the command as it was sent.
 *   - A later update that clears the laps and asks for a new stamp keeps the instance's
 *     id, removes the laps and writes the later moment; the database holds the result.
 *   - An update that only clears a field which is not on air is answered ok and leaves
 *     nothing behind: no event-log row, no listener told.
 *   - An update that re-sends the values already on air (an "Atualizar" pressed on an
 *     untouched form) leaves nothing behind either: the instances row is not saved
 *     again, no event-log row in memory or on disk, no listener told. The same update
 *     with a stamp asked for is a real change, and is saved, logged and broadcast.
 *
 * What these tests deliberately do not cover:
 *   - Every combination of null and stamp; the reducer tests cover them
 *     (putGraphicOnOutputClearedAndStampedFields.test.ts,
 *     updateInstanceDataClearedAndStampedFields.test.ts).
 *   - An item's `takeTime` field taken by Space and again later; storeTakeTimeField.test.ts
 *     covers it.
 */
import { describe, expect, it } from 'vitest';

import { countEventLogRows } from '../db/eventLogRowStorage.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import { createRaceClockItemOnTheStore } from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';
const idOfTheClockInstance = '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f';

// Two moments of the endurance race on 9 October 2026 (UTC), each also in milliseconds.
const momentOfTheTake = '2026-10-09T14:32:05.000Z';
const momentOfTheTakeInMilliseconds = 1_791_556_325_000;
const momentOfTheUpdate = '2026-10-09T14:47:30.250Z';
const momentOfTheUpdateInMilliseconds = 1_791_557_250_250;

/**
 * Prepares "Largada do enduro", a clock starting from zero at the green flag whose lap
 * field was cleared (a literal null) and whose reference moment is left to the take,
 * and returns the take of it ("No ar").
 */
function prepareTheTakeOfTheStartItem(store: StateStore) {
  const startItemId = createRaceClockItemOnTheStore(store, {
    label: 'Largada do enduro',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 0 },
      referenceWallClockMs: { kind: 'takeTime' },
      running: { kind: 'literal', value: true },
      lapsCompletedByLeader: { kind: 'literal', value: null },
    },
  });
  return { type: 'takeItem', itemId: startItemId };
}

/**
 * Builds a store on a fresh database with the built race clock (so its data schema is
 * checked) and a clock the test sets by hand, starting at the moment of the take.
 */
function createStoreWithAClockTheTestSets() {
  let momentTheClockShows = momentOfTheTake;
  const { database } = openTemporaryDatabase();
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentTheClockShows),
    createInstanceId: () => idOfTheClockInstance,
  });
  const setTheClockTo = (moment: string) => {
    momentTheClockShows = moment;
  };
  return { store, database, setTheClockTo };
}

describe('a take that leaves the reference moment to the server, through the store', () => {
  it('goes on air with the milliseconds of the take and without the cleared lap count', () => {
    // Arrange: a store whose clock shows 14:32:05, the start item prepared, nothing on air.
    const { store } = createStoreWithAClockTheTestSets();
    const takeOfTheStartItem = prepareTheTakeOfTheStartItem(store);

    // Act: take the start item.
    const outcome = store.applyCommand(takeOfTheStartItem, operatorActor);

    // Assert: accepted by the race clock's own schema; the data on air carries the
    // moment of the take and no lap count; the event log keeps the command as sent, so
    // it shows what was asked, not what was computed.
    expect(outcome, 'the take must be accepted').toEqual({ ok: true });
    const slicesAfter = store.readAllSlices();
    expect(
      slicesAfter.instances.map((instance) => instance.resolvedData),
      'the clock on air must count from the take and show no laps',
    ).toEqual([
      {
        sessionName: 'Enduro de Resistência',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        running: true,
        referenceWallClockMs: momentOfTheTakeInMilliseconds,
      },
    ]);
    expect(
      [slicesAfter.instances[0]?.takenAt, slicesAfter.eventLog.at(-1)?.ts],
      'the stamped field, takenAt and the event log must name one and the same moment',
    ).toEqual([momentOfTheTake, momentOfTheTake]);
    expect(
      slicesAfter.eventLog.at(-1)?.payload,
      'the event log must keep the command as it was sent',
    ).toEqual(takeOfTheStartItem);
  });
});

describe('an update that clears a field and asks for a new stamp, through the store', () => {
  it('keeps the instance, removes the laps and writes the later moment, in memory and on disk', () => {
    // Arrange: the clock taken at 14:32:05, the leader then shown on lap 12, and the
    // store's clock moved on to 14:47:30 and a quarter.
    const { store, database, setTheClockTo } = createStoreWithAClockTheTestSets();
    store.applyCommand(prepareTheTakeOfTheStartItem(store), operatorActor);
    store.applyCommand(
      {
        type: 'updateInstanceData',
        instanceId: idOfTheClockInstance,
        data: { lapsCompletedByLeader: 12 },
      },
      operatorActor,
    );
    setTheClockTo(momentOfTheUpdate);

    // Act: restart the clock from zero and clear the laps, as after a red-flag restart.
    const outcome = store.applyCommand(
      {
        type: 'updateInstanceData',
        instanceId: idOfTheClockInstance,
        data: { referenceTimeMs: 0, lapsCompletedByLeader: null },
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
      operatorActor,
    );

    // Assert: accepted; the same instance now counts from the update and shows no laps,
    // and the database holds exactly what memory holds.
    expect(outcome, 'the update must be accepted').toEqual({ ok: true });
    const instancesAfter = store.readAllSlices().instances;
    expect(
      instancesAfter.map((instance) => [instance.id, instance.takenAt, instance.resolvedData]),
      'the instance must keep its id and takenAt, lose the laps and get the later moment',
    ).toEqual([
      [
        idOfTheClockInstance,
        momentOfTheTake,
        {
          sessionName: 'Enduro de Resistência',
          state: 'green',
          clockMode: 'elapsed',
          referenceTimeMs: 0,
          running: true,
          referenceWallClockMs: momentOfTheUpdateInMilliseconds,
        },
      ],
    ]);
    const storedInstancesRow = readAllSliceRows(database).find((row) => row.name === 'instances');
    expect(storedInstancesRow?.json, 'the database must hold the updated instance').toEqual(
      instancesAfter,
    );
  });

  it('leaves nothing behind when the only field cleared is not on air', () => {
    // Arrange: the clock on air with no lap count, and a listener counting what it is told.
    const { store } = createStoreWithAClockTheTestSets();
    store.applyCommand(prepareTheTakeOfTheStartItem(store), operatorActor);
    const eventLogBefore = store.readAllSlices().eventLog;
    let numberOfTimesTheListenerWasTold = 0;
    store.subscribeToSliceChanges(() => {
      numberOfTimesTheListenerWasTold += 1;
    });

    // Act: press "limpar" on the laps field, which is already empty on air.
    const outcome = store.applyCommand(
      {
        type: 'updateInstanceData',
        instanceId: idOfTheClockInstance,
        data: { lapsCompletedByLeader: null },
      },
      operatorActor,
    );

    // Assert: ok, with no new event-log row and no broadcast (João's 2026-10-10 ruling).
    expect(outcome, 'clearing a field that is not on air must be answered ok').toEqual({
      ok: true,
    });
    expect(
      store.readAllSlices().eventLog,
      'a command that changed nothing must leave no event-log row',
    ).toBe(eventLogBefore);
    expect(numberOfTimesTheListenerWasTold, 'no listener must be told, so nothing is sent').toBe(0);
  });
});

describe('an update that re-sends the values already on air, through the store', () => {
  it('leaves nothing behind: no save, no event-log row and no listener told', () => {
    // Arrange: the clock taken under green flag at 14:32:05, the store's clock moved on
    // to 14:47:30 and a quarter, and a listener counting what it is told.
    const { store, database, setTheClockTo } = createStoreWithAClockTheTestSets();
    store.applyCommand(prepareTheTakeOfTheStartItem(store), operatorActor);
    setTheClockTo(momentOfTheUpdate);
    const eventLogBefore = store.readAllSlices().eventLog;
    const numberOfEventLogRowsBefore = countEventLogRows(database);
    let numberOfTimesTheListenerWasTold = 0;
    store.subscribeToSliceChanges(() => {
      numberOfTimesTheListenerWasTold += 1;
    });

    // Act: press "Atualizar" with the flag and the running state the air already holds.
    const outcome = store.applyCommand(
      {
        type: 'updateInstanceData',
        instanceId: idOfTheClockInstance,
        data: { state: 'green', running: true },
      },
      operatorActor,
    );

    // Assert: ok; the instances row on disk still carries the moment of the take (a save
    // would have written 14:47:30), the event log has no new row in memory or on disk,
    // and no listener was told.
    expect(outcome, 're-sending the values on air must be answered ok').toEqual({ ok: true });
    const storedInstancesRow = readAllSliceRows(database).find((row) => row.name === 'instances');
    expect(
      storedInstancesRow?.updatedAt,
      'the instances row must not be saved again when nothing on air changed',
    ).toBe(momentOfTheTake);
    expect(
      store.readAllSlices().eventLog,
      'a command that changed nothing must leave no event-log row in memory',
    ).toBe(eventLogBefore);
    expect(
      countEventLogRows(database),
      'a command that changed nothing must leave no event-log row on disk',
    ).toBe(numberOfEventLogRowsBefore);
    expect(numberOfTimesTheListenerWasTold, 'no listener must be told, so nothing is sent').toBe(0);
  });

  it('is saved, logged and broadcast when it also asks for a stamp', () => {
    // Arrange: the same clock on air, the store's clock moved on, and a listener writing
    // down the slices it is told about.
    const { store, database, setTheClockTo } = createStoreWithAClockTheTestSets();
    store.applyCommand(prepareTheTakeOfTheStartItem(store), operatorActor);
    setTheClockTo(momentOfTheUpdate);
    const numberOfEventLogRowsBefore = countEventLogRows(database);
    const changedSliceNamesHeard: string[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      changedSliceNamesHeard.push(changedSliceNames);
    });

    // Act: re-send the flag on air, and ask the server for a new reference moment.
    const outcome = store.applyCommand(
      {
        type: 'updateInstanceData',
        instanceId: idOfTheClockInstance,
        data: { state: 'green' },
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
      operatorActor,
    );

    // Assert: ok; the stamp is the later moment, so this is a real change: one new
    // event-log row and one notification naming the instances and the event log.
    expect(outcome, 'the update must be accepted').toEqual({ ok: true });
    expect(
      store.readAllSlices().instances[0]?.resolvedData.referenceWallClockMs,
      'the clock on air must now count from the moment of the update',
    ).toBe(momentOfTheUpdateInMilliseconds);
    expect(countEventLogRows(database), 'a stamped update must add exactly one event-log row').toBe(
      numberOfEventLogRowsBefore + 1,
    );
    expect(changedSliceNamesHeard, 'listeners must hear of the instances once').toEqual([
      ['instances', 'eventLog'],
    ]);
  });
});
