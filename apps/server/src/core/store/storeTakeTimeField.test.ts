/**
 * A field stamped with the moment of the take, through the store (apps/server)
 *
 * What this module is for:
 *   An item field may say `{ kind: 'takeTime' }` instead of holding a value: the race
 *   clock's reference moment is the usual one. When the item is taken, the store reads
 *   the clock once for the command and that one moment becomes the field's value, the
 *   instance's `takenAt` and the event-log row's time.
 *
 * What these tests prove (with a real SQLite file and the race clock's real data schema):
 *   - An item with a takeTime field is accepted by createItem and stored as takeTime.
 *   - Space (takeNext) puts it on air with the take's milliseconds in the field, the
 *     race clock's schema accepts that, and the database holds the same number.
 *   - Firing the same item again later (takeItem) stamps the later moment.
 *
 * What these tests deliberately do not cover:
 *   - Resolving field values in detail; resolveItemFields.test.ts covers it.
 *   - The other rundown commands through the store; storeRundownCommands.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readAllSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';

const operatorActor = 'operador:conexao-7';
const idOfTheStartItem = 'item-largada-do-enduro';

// Two moments of the endurance race on 9 October 2026 (UTC), each also in milliseconds.
const momentOfTheFirstTake = '2026-10-09T14:32:05.000Z';
const momentOfTheFirstTakeInMilliseconds = 1_791_556_325_000;
const momentOfTheSecondTake = '2026-10-09T14:47:30.250Z';
const momentOfTheSecondTakeInMilliseconds = 1_791_557_250_250;

// "Largada do enduro": a clock at zero that starts counting when the item goes on air.
const createStartItemThatStartsAtTheTake = {
  type: 'createItem',
  rundownId: 'sessao-principal',
  graphicId: 'race-clock',
  layerId: 'clock',
  label: 'Largada do enduro',
  fields: {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'elapsed' },
    referenceTimeMs: { kind: 'literal', value: 0 },
    referenceWallClockMs: { kind: 'takeTime' },
    running: { kind: 'literal', value: true },
  },
};

/**
 * Builds a store on a fresh database with the built race clock (so its data schema is
 * checked at the take) and a clock the test sets by hand, starting at the first take.
 */
function createStoreWithAClockTheTestSets() {
  let momentTheClockShows = momentOfTheFirstTake;
  const { database } = openTemporaryDatabase();
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentTheClockShows),
    createItemId: () => idOfTheStartItem,
  });
  const setTheClockTo = (moment: string) => {
    momentTheClockShows = moment;
  };
  return { store, database, setTheClockTo };
}

describe('an item whose clock starts at the take, through the store', () => {
  it('is stored as takeTime and goes on air with the milliseconds of the Space press', () => {
    // Arrange: a store whose clock shows 14:32:05, and the start item prepared in it.
    const { store, database } = createStoreWithAClockTheTestSets();
    const outcomeOfCreate = store.applyCommand(createStartItemThatStartsAtTheTake, operatorActor);

    // Act: press Space.
    const outcomeOfTake = store.applyCommand(
      { type: 'takeNext', rundownId: 'sessao-principal' },
      operatorActor,
    );

    // Assert: both commands accepted (the take passed the race clock's own schema); the
    // instance carries 14:32:05 in milliseconds, the moment its takenAt and the event log
    // say; the database holds the same instance; the item still says takeTime.
    expect(
      [outcomeOfCreate, outcomeOfTake],
      'creating and taking a takeTime item must be accepted',
    ).toEqual([{ ok: true }, { ok: true }]);
    const slicesAfter = store.readAllSlices();
    const instanceOnAir = slicesAfter.instances[0];
    expect(
      instanceOnAir?.resolvedData.referenceWallClockMs,
      'the clock on air must count from the moment of the take',
    ).toBe(momentOfTheFirstTakeInMilliseconds);
    expect(
      [instanceOnAir?.takenAt, slicesAfter.eventLog.at(-1)?.ts],
      'the stamped field, takenAt and the event log must name one and the same moment',
    ).toEqual([momentOfTheFirstTake, momentOfTheFirstTake]);
    const storedInstancesRow = readAllSliceRows(database).find((row) => row.name === 'instances');
    expect(storedInstancesRow?.json, 'the database must hold the stamped instance').toEqual(
      slicesAfter.instances,
    );
    expect(
      slicesAfter.items[0]?.fields.referenceWallClockMs,
      'the stored item must keep saying takeTime, never the moment of one take',
    ).toEqual({ kind: 'takeTime' });
  });

  it('stamps the later moment when the same item is fired again later', () => {
    // Arrange: the start item taken with Space at 14:32:05, then the clock moves on to
    // 14:47:30 and a quarter.
    const { store, setTheClockTo } = createStoreWithAClockTheTestSets();
    store.applyCommand(createStartItemThatStartsAtTheTake, operatorActor);
    store.applyCommand({ type: 'takeNext', rundownId: 'sessao-principal' }, operatorActor);
    setTheClockTo(momentOfTheSecondTake);

    // Act: fire the same row again with its button, as after a restart of the race.
    const outcome = store.applyCommand(
      { type: 'takeItem', itemId: idOfTheStartItem },
      operatorActor,
    );

    // Assert: accepted, and the one clock on air counts from the second take.
    expect(outcome, 'the second take must be accepted').toEqual({ ok: true });
    expect(
      store.readAllSlices().instances.map((instance) => instance.resolvedData.referenceWallClockMs),
      'the second take must carry its own moment, not the first one',
    ).toEqual([momentOfTheSecondTakeInMilliseconds]);
  });
});
