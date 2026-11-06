/**
 * The layer a take was applied on, written into its event-log row (apps/server)
 *
 * What this module is for:
 *   The history (BAJAOVRLAY-30) writes each row's sentence with the names the slices hold
 *   now. For a take that meant the item's layer now, so after the item moved the history
 *   named a layer the take never touched. Since gate 2 of PR #44 the store writes, into the
 *   row's details, the layer and output the take or preview put its item on, read from the
 *   instance it made; the sentence reads them from there.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - An accepted take writes details.placedOn, the layer and its output; a store opened
 *     again on the same file reads them back.
 *   - An accepted preview writes them too.
 *   - A refused take, and a command that places nothing ("Limpar"), write no details, and
 *     their rows read back without the field after a restart.
 *
 * What these tests deliberately do not cover:
 *   - How the sentence reads the details; packages/shared's layerRecordedInTheLog.test.ts.
 */
import type { EventLogEntry } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import { createRaceClockItemOnTheStore } from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';

/** Opens a store on the given database, at 14:32:05, with the built race clock. */
function openStoreOnDatabase(database: ServerDatabase, graphicPackagesFolder: string) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
    readCurrentTime: () => new Date('2026-10-09T14:32:05.000Z'),
  });
}

/** The row of the given command type, newest first, in the store's eventLog slice. */
function findNewestRowOf(eventLog: EventLogEntry[], commandType: string): EventLogEntry {
  const row = [...eventLog].reverse().find((entry) => entry.command === commandType);
  if (row === undefined) {
    throw new Error(`no ${commandType} row in the event log`);
  }
  return row;
}

describe('the details of an event-log row', () => {
  it('records where a take and a preview put their item, and keeps it across a restart', () => {
    // Arrange: the enduro clock on the "Relógio" layer of "Programa", previewed and taken;
    // then a "Limpar" and a take of an item that does not exist, refused.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, graphicPackagesFolder);
    const clockItemId = createRaceClockItemOnTheStore(storeBeforeRestart, {
      label: 'Relógio do enduro',
      layerId: 'clock',
    });
    storeBeforeRestart.applyCommand(
      { type: 'previewItem', itemId: clockItemId, origin: 'manual' },
      operatorActor,
    );
    storeBeforeRestart.applyCommand({ type: 'takeItem', itemId: clockItemId }, operatorActor);
    storeBeforeRestart.applyCommand({ type: 'clearLayer', layerId: 'clock' }, operatorActor);
    storeBeforeRestart.applyCommand(
      { type: 'takeItem', itemId: 'item-tarja-apagada' },
      operatorActor,
    );
    firstDatabase.$client.close();

    // Act: open the store again on the same file and read its event log.
    const storeAfterRestart = openStoreOnDatabase(
      openDatabaseForTests(databasePath),
      graphicPackagesFolder,
    );
    const eventLog = storeAfterRestart.readAllSlices().eventLog;

    // Assert: the take and the preview name "Relógio" on "Programa"; the clear and the
    // refused take carry no details at all.
    const whereItWentOnAir = { placedOn: { layerId: 'clock', outputId: 'program' } };
    const acceptedTake = eventLog.find(
      (entry) => entry.command === 'takeItem' && entry.result.status === 'ok',
    );
    expect(acceptedTake?.details, 'a take must record the layer and output it used').toEqual(
      whereItWentOnAir,
    );
    expect(
      findNewestRowOf(eventLog, 'previewItem').details,
      'a preview must record the layer and output it used',
    ).toEqual(whereItWentOnAir);
    expect(
      'details' in findNewestRowOf(eventLog, 'clearLayer'),
      'a clear places nothing, so its row has no details',
    ).toBe(false);
    expect(
      'details' in findNewestRowOf(eventLog, 'takeItem'),
      'a refused take put nothing anywhere, so its row has no details',
    ).toBe(false);
  });
});
