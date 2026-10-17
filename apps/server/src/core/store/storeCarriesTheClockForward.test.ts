/**
 * The race clock carried forward by an update, through the store (apps/server)
 *
 * What this module is for:
 *   When an operator stops the race clock on air, the control page sends one field,
 *   `running: false`. The server works out the time the screen shows at that moment and
 *   stores it with the update, so the clock stops where it is instead of jumping back
 *   to the time it went on air with. The store reads the clock once per command; that
 *   one moment is what the rule counts to, what it writes as the new reference moment,
 *   and the time of the event-log row.
 *
 * What these tests prove (with a real SQLite file and stand-in built graphics):
 *   - A clock taken at 9:45 running from 12:34 and stopped at 10:00 holds 27:34 with
 *     10:00 as its reference moment, in memory and in the database; the instance keeps
 *     its id; the event log keeps the command as it was sent (one field), not the
 *     fields the server added.
 *   - A graphic whose manifest names a rule the server does not know can be taken (as
 *     an item), but
 *     an update of it is refused in pt-BR, written to the event log as failed, and
 *     leaves the data on air and in the database as it was.
 *
 * What these tests deliberately do not cover:
 *   - The other ways an operator changes the clock (start, typed time, direction);
 *     reducers/updateInstanceDataCarriesTheClock.test.ts lists them.
 *   - The boot warning for the unknown rule; loadInitialSlicesUnusableUpdateRule.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readAllSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import {
  createGraphicsFolderWithBuiltRaceClock,
  createGraphicsFolderWithBuiltScoreboard,
} from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import {
  createItemOnTheStore,
  createRaceClockItemOnTheStore,
} from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';
const idOfTheInstanceOnAir = '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f';

// The Saturday of the endurance race, in Brasília time: the graphic goes on air at 9:45
// and the operator presses "Atualizar" at 10:00, 15 minutes (900 000 ms) later.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';
const tenOClockMs = Date.parse(tenOClock);

/**
 * Builds a store on a fresh database over the given graphics folder, with a clock the
 * test sets by hand, starting at 9:45.
 */
function createStoreWithAClockTheTestSets(graphicPackagesFolder: string) {
  let momentTheClockShows = quarterToTen;
  const { database } = openTemporaryDatabase();
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
    readCurrentTime: () => new Date(momentTheClockShows),
    createInstanceId: () => idOfTheInstanceOnAir,
  });
  const setTheClockTo = (moment: string) => {
    momentTheClockShows = moment;
  };
  return { store, database, setTheClockTo };
}

describe('stopping the race clock on air, through the store', () => {
  it('holds the time the screen showed at the press, in memory and in the database', () => {
    // Arrange: the first heat's item taken at 9:45, running from 12:34 (754 000 ms) with
    // the reference moment left to the take; then the store's clock moved on to 10:00,
    // when the screen shows 27:34 (1 654 000 ms).
    const { store, database, setTheClockTo } = createStoreWithAClockTheTestSets(
      createGraphicsFolderWithBuiltRaceClock(),
    );
    const firstHeatItemId = createRaceClockItemOnTheStore(store, {
      label: 'Bateria 1',
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência — Bateria 1' },
        state: { kind: 'literal', value: 'green' },
        clockMode: { kind: 'literal', value: 'elapsed' },
        referenceTimeMs: { kind: 'literal', value: 754_000 },
        referenceWallClockMs: { kind: 'takeTime' },
        running: { kind: 'literal', value: true },
      },
    });
    store.applyCommand({ type: 'takeItem', itemId: firstHeatItemId }, operatorActor);
    setTheClockTo(tenOClock);
    const stopTheClock = {
      type: 'updateInstanceData',
      instanceId: idOfTheInstanceOnAir,
      data: { state: 'red', running: false },
    };

    // Act: a red flag comes out; the operator sets the flag, stops the clock and
    // presses "Atualizar". The page sends those two fields and nothing about time.
    const outcome = store.applyCommand(stopTheClock, operatorActor);

    // Assert: accepted; the same instance is now held at 27:34 as of 10:00; the
    // database holds exactly what memory holds; and the event log shows what was
    // asked (two fields), not what the server worked out.
    expect(outcome, 'the update must be accepted').toEqual({ ok: true });
    const slicesAfter = store.readAllSlices();
    expect(
      slicesAfter.instances.map((instance) => [instance.id, instance.resolvedData]),
      'the clock must be held at the time it showed at the press, not at the take',
    ).toEqual([
      [
        idOfTheInstanceOnAir,
        {
          sessionName: 'Enduro de Resistência — Bateria 1',
          state: 'red',
          clockMode: 'elapsed',
          referenceTimeMs: 1_654_000,
          running: false,
          referenceWallClockMs: tenOClockMs,
        },
      ],
    ]);
    const storedInstancesRow = readAllSliceRows(database).find((row) => row.name === 'instances');
    expect(storedInstancesRow?.json, 'the database must hold the carried clock').toEqual(
      slicesAfter.instances,
    );
    expect(
      [slicesAfter.eventLog.at(-1)?.ts, slicesAfter.eventLog.at(-1)?.payload],
      'the event log must keep the moment of the press and the command as it was sent',
    ).toEqual([tenOClock, { ...stopTheClock, takeTimeFieldKeys: [] }]);
  });
});

describe('updating a graphic whose manifest names an unknown update rule, through the store', () => {
  it('lets it be taken, then refuses the update and leaves the air as it was', () => {
    // Arrange: a built scoreboard whose manifest mistypes the rule name ("Foward"), and
    // its item taken at 9:45 showing team 42 in the lead; then the clock moved on to 10:00.
    const { store, database, setTheClockTo } = createStoreWithAClockTheTestSets(
      createGraphicsFolderWithBuiltScoreboard({
        id: 'baja-scoreboard',
        name: 'Placar',
        main: 'scoreboard.js',
        schema: {
          type: 'object',
          properties: { leaderTeamNumber: { type: 'integer' }, leaderName: { type: 'string' } },
        },
        v_baja: {
          defaultLayerId: 'fullscreen',
          category: 'scoreboard',
          updateRule: 'carryClockFoward',
        },
      }),
    );
    const scoreboardItemId = createItemOnTheStore(store, {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'scoreboard',
      layerId: 'fullscreen',
      label: 'Placar — líder',
      fields: {
        leaderTeamNumber: { kind: 'literal', value: 42 },
        leaderName: { kind: 'literal', value: 'Baja UFPR' },
      },
    });
    const takeOutcome = store.applyCommand(
      { type: 'takeItem', itemId: scoreboardItemId },
      operatorActor,
    );
    setTheClockTo(tenOClock);

    // Act: team 7 takes the lead and the operator presses "Atualizar".
    const updateOutcome = store.applyCommand(
      {
        type: 'updateInstanceData',
        instanceId: idOfTheInstanceOnAir,
        data: { leaderTeamNumber: 7, leaderName: 'Baja Poli' },
      },
      operatorActor,
    );

    // Assert: the take was accepted (a take runs no rule); the update is refused in
    // pt-BR saying what to correct; the entry is in the event log as failed; team 42 is
    // still what is on air, and the database row was not saved again after 9:45.
    const expectedError = {
      code: 'INVALID_GRAPHIC_DATA',
      message:
        'O gráfico "scoreboard" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "carryClockFoward", que o servidor não conhece. Corrija o manifesto do gráfico e reinicie o servidor.',
    };
    expect(takeOutcome, 'the take must be accepted: a take runs no update rule').toEqual({
      ok: true,
    });
    expect(updateOutcome, 'the update must be refused, naming the graphic and the rule').toEqual({
      ok: false,
      error: expectedError,
    });
    const slicesAfter = store.readAllSlices();
    expect(slicesAfter.eventLog.at(-1)?.result, 'the refusal must be logged as failed').toEqual({
      status: 'failed',
      error: expectedError,
    });
    expect(
      slicesAfter.instances.map((instance) => instance.resolvedData),
      'the data on air must still be what the take put there',
    ).toEqual([{ leaderTeamNumber: 42, leaderName: 'Baja UFPR' }]);
    const storedInstancesRow = readAllSliceRows(database).find((row) => row.name === 'instances');
    expect(
      storedInstancesRow?.updatedAt,
      'the instances row must not be saved again by a refused update',
    ).toBe(quarterToTen);
  });
});
