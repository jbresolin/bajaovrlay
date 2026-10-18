/**
 * The rundown and item commands through the store (apps/server)
 *
 * What this module is for:
 *   The seven rundown commands (createItem, updateItemFields, deleteItem, reorderItems,
 *   moveCursor, takeItem, takeNext) go through the same single path as every other
 *   command: validate, authorise, reduce, save, log, tell subscribers. The store gives
 *   each new item its id, and saves the `rundowns` and `items` slices like the others.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - A created item is in memory and in the database, with the id the store made, and
 *     two items made with the default id maker get different ids.
 *   - Subscribers hear about exactly the slices each command changed: the rundowns only
 *     when a cursor moved, the items only when an item changed.
 *   - A rundown command that is accepted and changes nothing (the cursor moved to where
 *     it is, the same order, the same label) answers ok, writes no event-log row and
 *     tells no subscriber, like every other command that changes nothing.
 *   - Preparing two items and pressing "next" twice puts them on air in order, and a
 *     third press is refused in pt-BR and logged as failed.
 *   - Three clock items prepared before a session go on air one after the other with
 *     three presses of "next", each instance naming its item (the task's "done when").
 *   - A new store on the same file has the same rundowns, items and cursor.
 *
 * What these tests deliberately do not cover:
 *   - The rules of each command in detail; the tests in reducers/ cover them.
 *   - The auto-out that may follow a take; autoOut.test.ts covers it.
 */
import type { SliceName } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';

const operatorActor = 'operador:conexao-7';

/** Builds the createItem of a race clock item with the given label and flag. */
function buildCreateClockItemCommand(label: string, flagState: string) {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    graphicId: 'race-clock',
    layerId: 'clock',
    label,
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: flagState },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 3_900_000 },
      referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
      running: { kind: 'literal', value: true },
    },
  };
}

/**
 * Opens a store on the given database with the race clock registered. Its items get
 * the ids item-1, item-2, ... in the order they are created, so tests can name them.
 */
function openStoreWithNumberedItemIds(database: ServerDatabase, graphicPackagesFolder: string) {
  let numberOfItemIdsMade = 0;
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
    readCurrentTime: () => new Date('2026-10-09T14:32:05.000Z'),
    createItemId: () => {
      numberOfItemIdsMade += 1;
      return `item-${numberOfItemIdsMade}`;
    },
  });
}

/** Builds a fresh database, a graphics folder with the race clock, and a store on them. */
function createStoreOnFreshDatabase() {
  const databasePath = createTemporaryDatabasePath();
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const database = openDatabaseForTests(databasePath);
  const store = openStoreWithNumberedItemIds(database, graphicPackagesFolder);
  return { store, database, databasePath, graphicPackagesFolder };
}

describe('createItem through the store', () => {
  it('answers ok naming the new item, and keeps it in memory and in the database', () => {
    // Arrange: a freshly booted store, with the seeded rundown and no items.
    const { store, database } = createStoreOnFreshDatabase();

    // Act: create "Largada do enduro" as the operator.
    const outcome = store.applyCommand(
      buildCreateClockItemCommand('Largada do enduro', 'green'),
      operatorActor,
    );

    // Assert: ok, naming the id the store made (the item editor's "Salvar e disparar"
    // takes it next); one item with that id at position 0, neutral and without notes
    // because the command left those out; and the database holds the same list.
    expect(outcome, 'a valid createItem must answer ok with the new item id').toEqual({
      ok: true,
      createdItemId: 'item-1',
    });
    const itemsInMemory = store.readAllSlices().items;
    expect(
      itemsInMemory.map((item) => [item.id, item.label, item.order, item.color, item.notes]),
      'the item must be in memory with its id, position and the default colour and notes',
    ).toEqual([['item-1', 'Largada do enduro', 0, 'neutral', '']]);
    const storedItemsRow = readAllSliceRows(database).find((row) => row.name === 'items');
    expect(storedItemsRow?.json, 'the database must hold the same items as memory').toEqual(
      itemsInMemory,
    );
  });

  it('names no item in the answer to a command that creates none', () => {
    // Arrange: a store holding "Largada do enduro".
    const { store } = createStoreOnFreshDatabase();
    store.applyCommand(buildCreateClockItemCommand('Largada do enduro', 'green'), operatorActor);

    // Act: rename that item, which creates nothing.
    const outcome = store.applyCommand(
      { type: 'updateItemFields', itemId: 'item-1', label: 'Largada do enduro — 10h' },
      operatorActor,
    );

    // Assert: a plain ok; only a createItem names an item.
    expect(outcome, 'an answer may name an item only when one was created').toEqual({ ok: true });
  });

  it('gives two items different ids when no id maker is given', () => {
    // Arrange: a store built as production builds it, with the default id maker.
    const database = openDatabaseForTests(createTemporaryDatabasePath());
    const store = createStateStore({
      database,
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    });

    // Act: create two items.
    store.applyCommand(buildCreateClockItemCommand('Largada do enduro', 'green'), operatorActor);
    store.applyCommand(buildCreateClockItemCommand('Bandeira amarela', 'yellow'), operatorActor);

    // Assert: two items whose ids are not empty and not equal.
    const itemIds = store.readAllSlices().items.map((item) => item.id);
    expect(itemIds.length, 'both items must exist').toBe(2);
    expect(new Set(itemIds).size, 'no two items may share an id').toBe(2);
  });
});

describe('subscribers of the store and the rundown commands', () => {
  it('hear about exactly the slices each command changed', () => {
    // Arrange: a fresh store and a subscriber that writes down every change it hears.
    const { store } = createStoreOnFreshDatabase();
    const changedSliceNamesHeard: SliceName[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      changedSliceNamesHeard.push(changedSliceNames);
    });

    // Act: create two items, rename the second, then take the first.
    store.applyCommand(buildCreateClockItemCommand('Largada do enduro', 'green'), operatorActor);
    store.applyCommand(buildCreateClockItemCommand('Bandeira amarela', 'yellow'), operatorActor);
    store.applyCommand(
      { type: 'updateItemFields', itemId: 'item-2', label: 'Amarela no setor 3' },
      operatorActor,
    );
    store.applyCommand({ type: 'takeItem', itemId: 'item-1' }, operatorActor);

    // Assert: the first create also moved the cursor (first item of the rundown); the
    // second create and the rename changed only the items; the take changed what is on
    // air and the cursor, but no item.
    expect(changedSliceNamesHeard, 'each command must name exactly what it changed').toEqual([
      ['rundowns', 'items', 'eventLog'],
      ['items', 'eventLog'],
      ['items', 'eventLog'],
      ['instances', 'rundowns', 'eventLog'],
    ]);
  });
});

const rundownCommandsThatChangeNothingScenarios: Array<{
  name: string;
  command: Record<string, unknown>;
}> = [
  // The operator marks as "next" the row that already is.
  {
    name: 'moveCursor to the item the cursor is already on',
    command: { type: 'moveCursor', rundownId: 'sessao-principal', itemId: 'item-1' },
  },
  // A row dragged and dropped so that the list ends in the order it already had.
  {
    name: 'reorderItems to the order the rundown already has',
    command: {
      type: 'reorderItems',
      rundownId: 'sessao-principal',
      orderedItemIds: ['item-1', 'item-2'],
    },
  },
  // An update that carries the label the item already has.
  {
    name: 'updateItemFields with the label the item already has',
    command: { type: 'updateItemFields', itemId: 'item-1', label: 'Largada do enduro' },
  },
];

describe('a rundown command that is accepted and changes nothing', () => {
  it.each(rundownCommandsThatChangeNothingScenarios)(
    'answers ok, writes no event-log row and tells no subscriber: $name',
    ({ command }) => {
      // Arrange: a store with two prepared items, the cursor on the first, and a
      // subscriber that starts listening only now.
      const { store } = createStoreOnFreshDatabase();
      store.applyCommand(buildCreateClockItemCommand('Largada do enduro', 'green'), operatorActor);
      store.applyCommand(buildCreateClockItemCommand('Bandeira amarela', 'yellow'), operatorActor);
      const numberOfLogRowsBefore = store.readAllSlices().eventLog.length;
      const changedSliceNamesHeard: SliceName[][] = [];
      store.subscribeToSliceChanges((changedSliceNames) => {
        changedSliceNamesHeard.push(changedSliceNames);
      });

      // Act: send the command of this scenario, which asks for what is already so.
      const outcome = store.applyCommand(command, operatorActor);

      // Assert: the sender gets its ok, and nothing was logged or announced.
      expect(outcome, 'a command that changes nothing is still accepted').toEqual({ ok: true });
      expect(
        store.readAllSlices().eventLog.length,
        'an accepted command that changes nothing must write no event-log row',
      ).toBe(numberOfLogRowsBefore);
      expect(
        changedSliceNamesHeard,
        'an accepted command that changes nothing must not be announced, so nothing is broadcast',
      ).toEqual([]);
    },
  );
});

describe('preparing two items and firing them with "next"', () => {
  it('puts them on air in order, then refuses a third press in pt-BR and logs it as failed', () => {
    // Arrange: a fresh store with two prepared clock items.
    const { store } = createStoreOnFreshDatabase();
    store.applyCommand(buildCreateClockItemCommand('Largada do enduro', 'green'), operatorActor);
    store.applyCommand(buildCreateClockItemCommand('Bandeira amarela', 'yellow'), operatorActor);
    const takeNextInMainSession = { type: 'takeNext', rundownId: 'sessao-principal' };

    // Act: press "next" three times, noting which item is on air after each press.
    const itemIdsOnAirAfterEachPress: Array<string | undefined> = [];
    const outcomes = [];
    for (let pressNumber = 1; pressNumber <= 3; pressNumber += 1) {
      outcomes.push(store.applyCommand(takeNextInMainSession, operatorActor));
      itemIdsOnAirAfterEachPress.push(store.readAllSlices().instances[0]?.itemId);
    }

    // Assert: item 1, then item 2, then a refusal that leaves item 2 on air.
    expect(itemIdsOnAirAfterEachPress, 'the items must go on air in rundown order').toEqual([
      'item-1',
      'item-2',
      'item-2',
    ]);
    const expectedRefusal = {
      code: 'RUNDOWN_CURSOR_EMPTY',
      message:
        'O rundown "Sessão principal" não tem próximo item: o cursor não está em nenhum ' +
        'item. Escolha o próximo item antes de colocar no ar.',
    };
    expect(outcomes, 'two presses are accepted and the third is refused in pt-BR').toEqual([
      { ok: true },
      { ok: true },
      { ok: false, error: expectedRefusal },
    ]);
    expect(
      store.readAllSlices().eventLog.at(-1)?.result,
      'the refused press must be in the event log as failed, with the reason',
    ).toEqual({ status: 'failed', error: expectedRefusal });
  });
});

describe('preparing three clock items before a session and firing them with "next"', () => {
  it('puts each one on air in rundown order, named by its item, with the cursor always on the following one', () => {
    // Arrange: a fresh store with the three clock items of the endurance race, prepared
    // in the order they will be needed: the start, a yellow flag, the finish.
    const { store } = createStoreOnFreshDatabase();
    store.applyCommand(buildCreateClockItemCommand('Largada do enduro', 'green'), operatorActor);
    store.applyCommand(buildCreateClockItemCommand('Bandeira amarela', 'yellow'), operatorActor);
    store.applyCommand(
      buildCreateClockItemCommand('Chegada do enduro', 'checkered'),
      operatorActor,
    );
    const cursorBeforeAnyPress = store.readAllSlices().rundowns[0]?.cursorItemId;

    // Act: press "next" three times, as three presses of Space do, writing down after
    // each press what is on the clock layer and where the cursor went.
    const whatWasSeenAfterEachPress = [];
    for (let pressNumber = 1; pressNumber <= 3; pressNumber += 1) {
      const outcome = store.applyCommand(
        { type: 'takeNext', rundownId: 'sessao-principal' },
        operatorActor,
      );
      const slicesAfterThePress = store.readAllSlices();
      const instancesOnTheClockLayer = slicesAfterThePress.instances.filter(
        (instance) => instance.layerId === 'clock',
      );
      whatWasSeenAfterEachPress.push({
        outcome,
        numberOfInstancesOnTheClockLayer: instancesOnTheClockLayer.length,
        itemIdOnAir: instancesOnTheClockLayer[0]?.itemId,
        flagOnAir: instancesOnTheClockLayer[0]?.resolvedData.state,
        cursorItemId: slicesAfterThePress.rundowns[0]?.cursorItemId,
      });
    }

    // Assert: the cursor started on the first item; each press was accepted, replaced
    // the clock with the next item (one instance, carrying that item's id and its flag),
    // and moved the cursor one item on, ending on nothing after the last.
    expect(cursorBeforeAnyPress, 'the first item prepared must be the first "next"').toBe('item-1');
    expect(
      whatWasSeenAfterEachPress,
      'three presses must put the three items on air in rundown order',
    ).toEqual([
      {
        outcome: { ok: true },
        numberOfInstancesOnTheClockLayer: 1,
        itemIdOnAir: 'item-1',
        flagOnAir: 'green',
        cursorItemId: 'item-2',
      },
      {
        outcome: { ok: true },
        numberOfInstancesOnTheClockLayer: 1,
        itemIdOnAir: 'item-2',
        flagOnAir: 'yellow',
        cursorItemId: 'item-3',
      },
      {
        outcome: { ok: true },
        numberOfInstancesOnTheClockLayer: 1,
        itemIdOnAir: 'item-3',
        flagOnAir: 'checkered',
        cursorItemId: null,
      },
    ]);
  });
});

describe('a store opened on the file of a previous store', () => {
  it('has the same rundowns, items and cursor as before the restart', () => {
    // Arrange: a store with three items, reordered, the first one taken (so the cursor
    // moved on) and one deleted.
    const { store, database, databasePath, graphicPackagesFolder } = createStoreOnFreshDatabase();
    store.applyCommand(buildCreateClockItemCommand('Largada do enduro', 'green'), operatorActor);
    store.applyCommand(buildCreateClockItemCommand('Bandeira amarela', 'yellow'), operatorActor);
    store.applyCommand(
      buildCreateClockItemCommand('Chegada do enduro', 'checkered'),
      operatorActor,
    );
    store.applyCommand(
      {
        type: 'reorderItems',
        rundownId: 'sessao-principal',
        orderedItemIds: ['item-1', 'item-3', 'item-2'],
      },
      operatorActor,
    );
    store.applyCommand({ type: 'takeItem', itemId: 'item-1' }, operatorActor);
    store.applyCommand({ type: 'deleteItem', itemId: 'item-2' }, operatorActor);
    const slicesBeforeRestart = store.readAllSlices();

    // Act: restart, opening a new store on the same file.
    database.$client.close();
    const storeAfterRestart = openStoreWithNumberedItemIds(
      openDatabaseForTests(databasePath),
      graphicPackagesFolder,
    );

    // Assert: the cursor is on "Chegada do enduro" (the item after the one taken), the
    // two remaining items are numbered 0 and 1, and every slice equals what it was.
    const slicesAfterRestart = storeAfterRestart.readAllSlices();
    expect(
      slicesAfterRestart.rundowns[0]?.cursorItemId,
      'the cursor must come back where the take left it',
    ).toBe('item-3');
    expect(
      slicesAfterRestart.items.map((item) => [item.label, item.order]),
      'the remaining items must come back in their order',
    ).toEqual([
      ['Largada do enduro', 0],
      ['Chegada do enduro', 1],
    ]);
    expect(slicesAfterRestart, 'a restart must lose nothing').toEqual(slicesBeforeRestart);
  });
});
