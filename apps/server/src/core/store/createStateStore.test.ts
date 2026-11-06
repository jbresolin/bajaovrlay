/**
 * The state store and its single command path (apps/server)
 *
 * What this module is for:
 *   The store holds every slice in memory and is the only thing that changes them.
 *   `applyCommand(command, actor)` is the single code path, in this order: check the
 *   command's shape (Zod), authorise it (a hook the store is given; the default one
 *   decides by the actor's role), apply the command's pure reducer, save the changed slices and the
 *   event-log row in one SQLite transaction, then tell subscribers what changed.
 *
 * What these tests prove:
 *   - An invalid command is refused with the field named in a pt-BR message, written to
 *     the event log as failed, and leaves the slices alone.
 *   - A null or absent command is refused alike and reaches the event log, memory and disk.
 *   - A successful command is in the event log with its actor and timestamp, in memory
 *     and in the database. A take is a takeItem of an item created first (BAJAOVRLAY-37).
 *   - A command refused by its reducer or by the authorisation hook is written to the
 *     event log as failed, and leaves the slices alone.
 *   - An accepted command that changes nothing (a second OBS machine reporting the same
 *     clock on air, or any other, such as a clear of an empty stage) is answered ok and
 *     leaves no trace: no event-log row in memory or on disk, and no subscriber told.
 *   - Subscribers hear about exactly the slices that changed.
 *   - When saving fails, memory keeps matching the database: nothing changes.
 *
 * What these tests deliberately do not cover:
 *   - The rules of each command; the tests in reducers/ cover them.
 *   - Which actor the default authorisation hook lets through; authorizeCommand.test.ts
 *     and storeAuthorisation.test.ts cover it.
 *   - Restarting from the database file and seeding; storeRestart.test.ts and
 *     loadInitialSlices.test.ts cover those.
 */
import type { SliceName } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { readNewestEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import type { IsCommandAllowed } from './authorizeCommand.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import {
  buildGreenFlagEnduroClockData,
  createRaceClockItemOnTheStore,
} from './raceClockItemOnTheStore.testSupport.js';

const timeOfEveryCommand = new Date('2026-10-09T14:32:05.000Z');
const idOfEveryNewInstance = '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f';
const idOfTheRaceClockItem = 'item-relogio-do-enduro';
const operatorActor = 'operador:conexao-7';

// "No ar" on the race clock item: the take every test below sends, once the item exists.
const takeOfTheRaceClockItem = { type: 'takeItem', itemId: idOfTheRaceClockItem };

/**
 * Builds a store on a fresh temporary database, seeded with the five layers and the
 * race clock, with a fixed clock and instance id so results can be compared exactly.
 */
function createStoreWithRaceClockRegistered(
  options: { isCommandAllowed?: IsCommandAllowed; database?: ServerDatabase } = {},
) {
  const database = options.database ?? openTemporaryDatabase().database;
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => timeOfEveryCommand,
    createInstanceId: () => idOfEveryNewInstance,
    createItemId: () => idOfTheRaceClockItem,
    isCommandAllowed: options.isCommandAllowed,
  });
  return { store, database };
}

describe('applyCommand with an invalid command', () => {
  it('refuses it with the missing field named in a pt-BR message', () => {
    // Arrange: a store, and a take that forgot to say which item.
    const { store } = createStoreWithRaceClockRegistered();
    const takeWithoutItem = { type: 'takeItem' };

    // Act: apply it as the operator.
    const outcome = store.applyCommand(takeWithoutItem, operatorActor);

    // Assert: refused with a stable code and a message naming itemId.
    expect(outcome, 'the refusal must name the missing field in pt-BR').toEqual({
      ok: false,
      error: {
        code: 'INVALID_COMMAND',
        message: 'Comando inválido: o campo "itemId" está ausente ou tem um valor errado.',
      },
    });
  });

  it('writes it to the event log as failed and leaves the instances alone', () => {
    // Arrange: a store, and a command type the server does not know.
    const { store } = createStoreWithRaceClockRegistered();
    const instancesBefore = store.readAllSlices().instances;
    // (Once takeItem, runMacro, setOverride, importEntities, switchObsScene; now OBS's stream.)
    const unknownCommand = { type: 'startObsStream' };

    // Act: apply it as the operator.
    store.applyCommand(unknownCommand, operatorActor);

    // Assert: one failed entry naming the command as sent, and no instance change.
    const slicesAfter = store.readAllSlices();
    expect(slicesAfter.eventLog, 'the failed command must be in the event log').toEqual([
      {
        id: 1,
        ts: '2026-10-09T14:32:05.000Z',
        actor: 'operador:conexao-7',
        command: 'startObsStream',
        payload: unknownCommand,
        result: {
          status: 'failed',
          error: {
            code: 'INVALID_COMMAND',
            message: 'Comando inválido: o campo "type" está ausente ou tem um valor errado.',
          },
        },
      },
    ]);
    expect(slicesAfter.instances, 'a failed command must not change instances').toBe(
      instancesBefore,
    );
  });
});

const missingCommandScenarios = [
  // A WS message `{"type":"command","command":null}` passes the envelope check, so the
  // store must cope with null itself.
  { name: 'a null command', commandInput: null },
  // A WS message with no `command` field at all, or a direct caller passing nothing.
  { name: 'no command at all', commandInput: undefined },
];

describe('applyCommand when no command was sent', () => {
  it.each(missingCommandScenarios)(
    'refuses $name and still writes it to the event log as failed',
    ({ commandInput }) => {
      // Arrange: a store with nothing in its event log yet.
      const { store, database } = createStoreWithRaceClockRegistered();

      // Act: apply the missing command as the operator.
      const outcome = store.applyCommand(commandInput, operatorActor);

      // Assert: an INVALID_COMMAND refusal, and a failed row in memory and on disk.
      const expectedError = {
        code: 'INVALID_COMMAND',
        message: 'Comando inválido: envie um objeto com o campo "type".',
      };
      expect(outcome, 'a missing command must be refused as invalid').toEqual({
        ok: false,
        error: expectedError,
      });
      const expectedEntry = {
        id: 1,
        ts: '2026-10-09T14:32:05.000Z',
        actor: 'operador:conexao-7',
        command: 'unknown',
        payload: { commandWasMissing: true },
        result: { status: 'failed', error: expectedError },
      };
      expect(store.readAllSlices().eventLog, 'the slice must hold the failed entry').toEqual([
        expectedEntry,
      ]);
      expect(
        readNewestEventLogRows(database, 10),
        'the database must hold the failed entry too, not lose it to a NOT NULL error',
      ).toEqual([{ ...expectedEntry, details: null }]); // details: NULL, nothing to add
    },
  );
});

describe('applyCommand with a valid command', () => {
  it('answers ok and puts the new instance in memory', () => {
    // Arrange: a store with the race clock registered, its item prepared, nothing on air.
    const { store } = createStoreWithRaceClockRegistered();
    createRaceClockItemOnTheStore(store);

    // Act: take the race clock item as the operator.
    const outcome = store.applyCommand(takeOfTheRaceClockItem, operatorActor);

    // Assert: ok, and the clock instance is now in the instances slice.
    expect(outcome, 'a valid take must answer ok, naming no item').toEqual({ ok: true });
    expect(store.readAllSlices().instances, 'the clock must be the one instance').toEqual([
      {
        id: idOfEveryNewInstance,
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: buildGreenFlagEnduroClockData(),
        currentStep: 0,
        status: 'loading',
        takenAt: '2026-10-09T14:32:05.000Z',
        itemId: idOfTheRaceClockItem,
      },
    ]);
  });

  it('writes it to the event log with its actor and timestamp, in memory and in the database', () => {
    // Arrange: a store with the race clock registered and its item prepared (entry 1).
    const { store, database } = createStoreWithRaceClockRegistered();
    createRaceClockItemOnTheStore(store);

    // Act: take the race clock item as the operator.
    store.applyCommand(takeOfTheRaceClockItem, operatorActor);

    // Assert: the take's ok entry, after the createItem, is newest in both, with its layer.
    const expectedEntry = {
      id: 2,
      ts: '2026-10-09T14:32:05.000Z',
      actor: 'operador:conexao-7',
      command: 'takeItem',
      payload: takeOfTheRaceClockItem,
      result: { status: 'ok' },
      details: { placedOn: { layerId: 'clock', outputId: 'program' } },
    };
    expect(store.readAllSlices().eventLog.at(-1), 'the slice must hold the ok entry').toEqual(
      expectedEntry,
    );
    expect(readNewestEventLogRows(database, 1), 'the database must hold the same entry').toEqual([
      expectedEntry,
    ]);
  });
});

describe('applyCommand with an accepted command that changes nothing', () => {
  it('answers ok, writes no event-log row and tells no subscriber', () => {
    // Arrange: the race clock item taken and already reported on air by the main OBS
    // machine, and a subscriber that starts writing down what it hears only now.
    const { store, database } = createStoreWithRaceClockRegistered();
    const reportRaceClockOnAir = {
      type: 'reportInstanceStatus',
      instanceId: idOfEveryNewInstance,
      status: 'on-air',
    };
    createRaceClockItemOnTheStore(store);
    store.applyCommand(takeOfTheRaceClockItem, operatorActor);
    store.applyCommand(reportRaceClockOnAir, 'renderer:conexao-obs');
    const slicesBefore = store.readAllSlices();
    const changedSliceNamesHeard: SliceName[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      changedSliceNamesHeard.push(changedSliceNames);
    });

    // Act: the backup OBS machine, which shows the same clock, reports it on air too.
    const outcome = store.applyCommand(reportRaceClockOnAir, 'renderer:conexao-obs-reserva');

    // Assert: the sender is told ok and nothing else happened: the event log still holds
    // only the item, the take and the first report; memory is untouched; no one heard.
    expect(outcome, 'a command that changes nothing is still accepted').toEqual({ ok: true });
    expect(
      store.readAllSlices().eventLog.map((entry) => [entry.actor, entry.command]),
      'the event-log slice must hold only the item, the take and the first report',
    ).toEqual([
      ['operador:conexao-7', 'createItem'],
      ['operador:conexao-7', 'takeItem'],
      ['renderer:conexao-obs', 'reportInstanceStatus'],
    ]);
    expect(
      readNewestEventLogRows(database, 10),
      'the event_log table must not gain a row for a command that changed nothing',
    ).toHaveLength(3);
    expect(
      store.readAllSlices(),
      'memory must be left exactly as it was, the very same slices',
    ).toBe(slicesBefore);
    expect(
      changedSliceNamesHeard,
      'no subscriber may be told anything, so nothing is broadcast',
    ).toEqual([]);
  });
});

describe('applyCommand with a command that must be refused', () => {
  it('writes a take of a missing item to the event log as failed and leaves the slices alone', () => {
    // Arrange: a store with no item at all, so the race clock item does not exist.
    const { store } = createStoreWithRaceClockRegistered();
    const instancesBefore = store.readAllSlices().instances;

    // Act: take the race clock item as the operator.
    const outcome = store.applyCommand(takeOfTheRaceClockItem, operatorActor);

    // Assert: refused, logged as failed with the same error, instances untouched.
    const expectedError = {
      code: 'ITEM_NOT_FOUND',
      message: 'O item "item-relogio-do-enduro" não existe; ele pode ter sido excluído.',
    };
    const slicesAfter = store.readAllSlices();
    expect(outcome, 'the refusal must carry the reducer reason').toEqual({
      ok: false,
      error: expectedError,
    });
    expect(slicesAfter.eventLog[0]?.result, 'the entry must be failed, with the reason').toEqual({
      status: 'failed',
      error: expectedError,
    });
    expect(slicesAfter.instances, 'a refused command must not change instances').toBe(
      instancesBefore,
    );
  });

  it('refuses a command the authorisation hook rejects, and writes it as failed', () => {
    // Arrange: a store whose hook rejects every command from a viewer-only actor, and
    // the race clock item the operator prepared.
    const { store } = createStoreWithRaceClockRegistered({
      isCommandAllowed: (command, actor) => actor !== 'convidado:conexao-9',
    });
    createRaceClockItemOnTheStore(store);

    // Act: the viewer tries to take the race clock item.
    const outcome = store.applyCommand(takeOfTheRaceClockItem, 'convidado:conexao-9');

    // Assert: refused in pt-BR, logged as failed, and nothing went on air.
    const expectedError = {
      code: 'NOT_ALLOWED',
      message: 'Você não tem permissão para executar este comando.',
    };
    const slicesAfter = store.readAllSlices();
    expect(outcome, 'a rejected command must be refused').toEqual({
      ok: false,
      error: expectedError,
    });
    expect(slicesAfter.eventLog.at(-1)?.result, 'the rejection must be logged').toEqual({
      status: 'failed',
      error: expectedError,
    });
    expect(slicesAfter.instances, 'nothing may go on air').toEqual([]);
  });
});

describe('subscribers of the store', () => {
  it('hear about exactly the slices a take changed', () => {
    // Arrange: a store with the race clock item prepared, and only then a subscriber
    // that writes down every change it hears about.
    const { store } = createStoreWithRaceClockRegistered();
    createRaceClockItemOnTheStore(store);
    const changedSliceNamesHeard: SliceName[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      changedSliceNamesHeard.push(changedSliceNames);
    });

    // Act: take the race clock item.
    store.applyCommand(takeOfTheRaceClockItem, operatorActor);

    // Assert: one notification for the instances, what the clock layer showed before (for
    // "Desfazer"), the rundowns (the cursor moved past the item) and the event log, nothing else.
    expect(changedSliceNamesHeard, 'a take of the cursor item changes four slices').toEqual([
      ['instances', 'programHistory', 'rundowns', 'eventLog'],
    ]);
  });

  it('hear only about the event log when a command fails', () => {
    // Arrange: a store and a subscriber that writes down every change it hears about.
    const { store } = createStoreWithRaceClockRegistered();
    const changedSliceNamesHeard: SliceName[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      changedSliceNamesHeard.push(changedSliceNames);
    });

    // Act: clear a layer that does not exist.
    store.applyCommand({ type: 'clearLayer', layerId: 'placar' }, operatorActor);

    // Assert: one notification, for the event log only.
    expect(changedSliceNamesHeard, 'a failed command changes only the event log').toEqual([
      ['eventLog'],
    ]);
  });
});

describe('applyCommand when saving to the database fails', () => {
  it('throws and leaves memory exactly as it was, matching the database', () => {
    // Arrange: the clock item prepared, then the event_log table gone, as a damaged file might.
    // The copy is a deep one: readAllSlices hands out the live object, so comparing
    // against it would also pass if memory were changed in place before the throw.
    const { store, database } = createStoreWithRaceClockRegistered();
    createRaceClockItemOnTheStore(store);
    const copyOfSlicesBefore = structuredClone(store.readAllSlices());
    database.$client.exec('DROP TABLE event_log');

    // Act: try to take the race clock item.
    const applyTheTake = () => store.applyCommand(takeOfTheRaceClockItem, operatorActor);

    // Assert: the error surfaces, memory still holds the slices from before, and the
    // instances row in the database is still the seeded empty list, like memory.
    expect(applyTheTake, 'a failed save must not be hidden').toThrow();
    expect(store.readAllSlices(), 'memory must not run ahead of the database').toEqual(
      copyOfSlicesBefore,
    );
    const instancesRowInDatabase = readAllSliceRows(database).find(
      (row) => row.name === 'instances',
    );
    expect(
      instancesRowInDatabase?.json,
      'the rolled-back transaction must leave the saved instances empty, as in memory',
    ).toEqual([]);
    expect(store.readAllSlices().instances, 'memory must hold the same empty list').toEqual([]);
  });
});
