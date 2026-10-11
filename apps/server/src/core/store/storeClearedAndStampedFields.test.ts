/**
 * Cleared fields and fields stamped by the server, through the store (apps/server)
 *
 * What this module is for:
 *   The control page's generated form never reads its own clock and never sends a
 *   cleared field to a graphic. A take or an update names the fields the server must
 *   stamp (`takeTimeFieldKeys`) and sends a cleared field as `null`. The store reads the
 *   clock once per command, and that one moment becomes the stamped field's value, the
 *   instance's `takenAt` (on a take) and the event-log row's time.
 *
 * What these tests prove (with a real SQLite file and the race clock's real data schema):
 *   - A take sent as the control page sends it (no target, a null lap count, the
 *     reference moment left to the server) goes on air with the take's milliseconds
 *     and no lap count; the event log keeps the command as it was sent.
 *   - A later update that clears the laps and asks for a new stamp keeps the instance's
 *     id, removes the laps and writes the later moment; the database holds the result.
 *   - An update that only clears a field which is not on air is answered ok and leaves
 *     nothing behind: no event-log row, no listener told.
 *
 * What these tests deliberately do not cover:
 *   - Every combination of null and stamp; the reducer tests cover them
 *     (takeGraphicClearedAndStampedFields.test.ts,
 *     updateInstanceDataClearedAndStampedFields.test.ts).
 *   - An item's `takeTime` field; storeTakeTimeField.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import { readAllSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';

const operatorActor = 'operador:conexao-7';
const idOfTheClockInstance = '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f';

// Two moments of the endurance race on 9 October 2026 (UTC), each also in milliseconds.
const momentOfTheTake = '2026-10-09T14:32:05.000Z';
const momentOfTheTakeInMilliseconds = 1_791_556_325_000;
const momentOfTheUpdate = '2026-10-09T14:47:30.250Z';
const momentOfTheUpdateInMilliseconds = 1_791_557_250_250;

// The take the generated form sends for a clock starting from zero at the green flag:
// the lap field was cleared (null) and the reference moment is left to the server.
const takeRaceClockStartingAtTheTake = {
  type: 'takeGraphic',
  graphicId: 'race-clock',
  layerId: 'clock',
  data: {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 0,
    running: true,
    lapsCompletedByLeader: null,
  },
  takeTimeFieldKeys: ['referenceWallClockMs'],
};

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
    // Arrange: a store whose clock shows 14:32:05 and nothing on air.
    const { store } = createStoreWithAClockTheTestSets();

    // Act: take the race clock as the generated form does.
    const outcome = store.applyCommand(takeRaceClockStartingAtTheTake, operatorActor);

    // Assert: accepted by the race clock's own schema; the data on air carries the
    // moment of the take and no lap count; the event log keeps the command as sent
    // (plus the default output), so it shows what was asked, not what was computed.
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
    ).toEqual({ ...takeRaceClockStartingAtTheTake, target: 'program' });
  });
});

describe('an update that clears a field and asks for a new stamp, through the store', () => {
  it('keeps the instance, removes the laps and writes the later moment, in memory and on disk', () => {
    // Arrange: the clock taken at 14:32:05, the leader then shown on lap 12, and the
    // store's clock moved on to 14:47:30 and a quarter.
    const { store, database, setTheClockTo } = createStoreWithAClockTheTestSets();
    store.applyCommand(takeRaceClockStartingAtTheTake, operatorActor);
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
    store.applyCommand(takeRaceClockStartingAtTheTake, operatorActor);
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
