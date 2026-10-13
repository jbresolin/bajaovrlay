/**
 * Previewing and then taking, through the store (apps/server)
 *
 * What this module is for:
 *   The operator's loop is "look, then take": previewItem shows an item on the preview
 *   output, takePreview sends exactly that to the program output, stopPreview throws it
 *   away. The reducers decide what changes; the store checks the command, saves the
 *   result to SQLite, writes the event log and tells its subscribers. This file follows
 *   one whole loop through the real store.
 *
 * What these tests prove (with a real SQLite file and the race clock's real data schema):
 *   - previewItem puts the item on the preview output and changes only the instances:
 *     subscribers hear about `instances` and the event log, never about the rundowns.
 *     The origin the page sent (`auto`, "Prévia automática") is on the stored preview.
 *   - takePreview fifteen minutes later puts the same data on program, except that the
 *     clock's reference moment is the moment of the take; the preview is gone, the cursor
 *     moved on, and the database holds exactly what memory holds.
 *   - takePreview with nothing previewed is refused in pt-BR and logged as failed.
 *   - stopPreview where nothing is previewed is answered ok and leaves no trace: no
 *     event-log row, no subscriber told, nothing written to the database.
 *
 * What these tests deliberately do not cover:
 *   - Every rule of each command; the reducer tests (previewItem, previewGraphic,
 *     stopPreview, takePreview, takePreviewCursor) cover them one by one.
 *   - Who may send these commands; authorizeCommand.test.ts.
 *   - A restart, which drops previews; storeRestartDropsPreviews.test.ts.
 */
import type { SliceName } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { countEventLogRows } from '../db/eventLogRowStorage.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';

const operatorActor = 'operador:conexao-7';
const idOfTheStartItem = 'item-largada-do-enduro';

// Two moments of the endurance race on 9 October 2026 (UTC), each also in milliseconds.
const momentOfThePreview = '2026-10-09T14:32:05.000Z';
const momentOfThePreviewInMilliseconds = 1_791_556_325_000;
const momentOfTheTake = '2026-10-09T14:47:30.250Z';
const momentOfTheTakeInMilliseconds = 1_791_557_250_250;

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
 * Builds a store on a fresh database with the built race clock, a clock the test sets by
 * hand (starting at the preview), instance ids that count up (`instancia-1`, ...) and a
 * list of what subscribers were told. The start item is already created, which also puts
 * the rundown's cursor on it (it is the first item of an empty rundown). The store makes
 * an instance id for every command, used or not, so creating the item used up
 * `instancia-1`: the preview gets `instancia-2` and the take `instancia-3`.
 */
function createStoreWithTheStartItemPrepared() {
  let momentTheClockShows = momentOfThePreview;
  let numberOfInstancesCreated = 0;
  const { database } = openTemporaryDatabase();
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentTheClockShows),
    createItemId: () => idOfTheStartItem,
    createInstanceId: () => {
      numberOfInstancesCreated += 1;
      return `instancia-${numberOfInstancesCreated}`;
    },
  });
  store.applyCommand(createStartItemThatStartsAtTheTake, operatorActor);

  const sliceNamesToldToSubscribers: SliceName[][] = [];
  store.subscribeToSliceChanges((changedSliceNames) => {
    sliceNamesToldToSubscribers.push(changedSliceNames);
  });
  const setTheClockTo = (moment: string) => {
    momentTheClockShows = moment;
  };
  return { store, database, setTheClockTo, sliceNamesToldToSubscribers };
}

describe('previewing an item and then taking the preview, through the store', () => {
  it('previews without touching program or the rundown, then takes with the moment of the take', () => {
    // Arrange: a store with the start item prepared and the cursor on it, at 14:32:05.
    const { store, database, setTheClockTo, sliceNamesToldToSubscribers } =
      createStoreWithTheStartItemPrepared();

    // Act: preview the item as "Prévia automática" does when the cursor arrives on it;
    // fifteen minutes later, press "Tomar" for the clock layer.
    const outcomeOfPreview = store.applyCommand(
      { type: 'previewItem', itemId: idOfTheStartItem, origin: 'auto' },
      operatorActor,
    );
    const instancesWhilePreviewed = store.readAllSlices().instances;
    const cursorWhilePreviewed = store.readAllSlices().rundowns[0]?.cursorItemId;
    setTheClockTo(momentOfTheTake);
    const outcomeOfTake = store.applyCommand(
      { type: 'takePreview', layerId: 'clock' },
      operatorActor,
    );

    // Assert, the preview: accepted; one instance, on the preview output, whose clock
    // counts from the preview, which remembers that field and who asked for it; the
    // cursor did not move.
    expect([outcomeOfPreview, outcomeOfTake], 'both commands must be accepted').toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(instancesWhilePreviewed, 'the preview must be the only instance, on preview').toEqual([
      {
        id: 'instancia-2',
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'preview',
        resolvedData: {
          sessionName: 'Enduro de Resistência',
          state: 'green',
          clockMode: 'elapsed',
          referenceTimeMs: 0,
          referenceWallClockMs: momentOfThePreviewInMilliseconds,
          running: true,
        },
        currentStep: 0,
        status: 'loading',
        takenAt: momentOfThePreview,
        previewOrigin: 'auto',
        itemId: idOfTheStartItem,
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
    ]);
    expect(cursorWhilePreviewed, 'a preview must leave the cursor on the item').toBe(
      idOfTheStartItem,
    );

    // Assert, the take: one instance, on program, new, with the same data except the
    // reference moment, which is the take's; the cursor moved past the last item.
    const slicesAfter = store.readAllSlices();
    expect(slicesAfter.instances, 'the take must leave one new program instance').toEqual([
      {
        id: 'instancia-3',
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: {
          sessionName: 'Enduro de Resistência',
          state: 'green',
          clockMode: 'elapsed',
          referenceTimeMs: 0,
          referenceWallClockMs: momentOfTheTakeInMilliseconds,
          running: true,
        },
        currentStep: 0,
        status: 'loading',
        takenAt: momentOfTheTake,
        itemId: idOfTheStartItem,
      },
    ]);
    expect(
      slicesAfter.rundowns[0],
      'taking the preview of the cursor item must move the cursor on, as takeItem does',
    ).toEqual(expect.objectContaining({ cursorItemId: null, wasLastItemTakenAtCursor: true }));

    // Assert, around the reducers: subscribers heard of the instances alone for the
    // preview and of instances and rundowns for the take; the event log has both
    // commands; the database holds what memory holds.
    expect(sliceNamesToldToSubscribers, 'a preview must not report the rundowns').toEqual([
      ['instances', 'eventLog'],
      ['instances', 'rundowns', 'eventLog'],
    ]);
    expect(
      slicesAfter.eventLog.map((entry) => [entry.command, entry.result.status, entry.ts]),
      'the event log must show the preview and the take, each at its own moment',
    ).toEqual([
      ['createItem', 'ok', momentOfThePreview],
      ['previewItem', 'ok', momentOfThePreview],
      ['takePreview', 'ok', momentOfTheTake],
    ]);
    const storedRows = readAllSliceRows(database);
    expect(
      storedRows.find((row) => row.name === 'instances')?.json,
      'the database must hold the instance that is on air',
    ).toEqual(slicesAfter.instances);
    expect(
      storedRows.find((row) => row.name === 'rundowns')?.json,
      'the database must hold the moved cursor',
    ).toEqual(slicesAfter.rundowns);
  });
});

describe('takePreview with nothing previewed, through the store', () => {
  it('is refused in pt-BR and written to the event log as failed', () => {
    // Arrange: a store with the start item prepared and nothing on any output.
    const { store } = createStoreWithTheStartItemPrepared();

    // Act: press "Tomar" for the clock layer.
    const outcome = store.applyCommand({ type: 'takePreview', layerId: 'clock' }, operatorActor);

    // Assert: refused with the layer named as the operator reads it; nothing on air; the
    // refusal is in the event log.
    expect(outcome, 'a take of an empty preview must be refused').toEqual({
      ok: false,
      error: {
        code: 'LAYER_PREVIEW_EMPTY',
        message: 'Não há nada em prévia na camada "Relógio" para colocar no ar.',
      },
    });
    expect(store.readAllSlices().instances, 'nothing may go on air').toEqual([]);
    expect(
      store.readAllSlices().eventLog.map((entry) => [entry.command, entry.result.status]),
      'the refused take must be logged as failed',
    ).toEqual([
      ['createItem', 'ok'],
      ['takePreview', 'failed'],
    ]);
  });
});

describe('stopPreview where nothing is previewed, through the store', () => {
  const nothingToStopScenarios = [
    // "Descartar" pressed for a layer whose preview is already gone.
    { name: 'leaves no trace for one layer with no preview', layerId: 'clock' },
    // "Stop every preview" with no preview anywhere.
    { name: 'leaves no trace for every layer when none has a preview', layerId: null },
  ];

  it.each(nothingToStopScenarios)('$name', ({ layerId }) => {
    // Arrange: a store with the start item prepared and nothing previewed; what the
    // database holds for the instances at this point, and how many log rows there are.
    const { store, database, sliceNamesToldToSubscribers } = createStoreWithTheStartItemPrepared();
    const instancesRowBefore = readAllSliceRows(database).find((row) => row.name === 'instances');
    const numberOfEventLogRowsBefore = countEventLogRows(database);

    // Act: stop the preview as the row says.
    const outcome = store.applyCommand({ type: 'stopPreview', layerId }, operatorActor);

    // Assert: ok, and nothing at all was written or told.
    expect(outcome, 'stopping nothing must be answered ok').toEqual({ ok: true });
    expect(sliceNamesToldToSubscribers, 'no subscriber may be told').toEqual([]);
    expect(countEventLogRows(database), 'no event-log row may be written').toBe(
      numberOfEventLogRowsBefore,
    );
    expect(
      readAllSliceRows(database).find((row) => row.name === 'instances'),
      'the instances row of the database must be untouched',
    ).toEqual(instancesRowBefore);
  });
});
