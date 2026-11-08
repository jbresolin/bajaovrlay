/**
 * A finished backup in the event log (apps/server)
 *
 * What this module is for:
 *   Each backup the operator downloads writes one event-log row (BAJAOVRLAY-33): the
 *   backup sends recordBackup, signed `sistema:backup`, through the one command path.
 *   recordBackup changes no slice, and the store normally writes no row for a command that
 *   changes nothing (a clear of an empty layer). Its reducer says the row is the point
 *   (`isLoggedWithoutAChange`), so the store saves the row, appends it to the eventLog
 *   slice and tells listeners, with every other slice left as it was.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - recordBackup from sistema:backup writes one row with its payload and the store's
 *     moment, tells listeners only that the event log changed, and changes no other slice.
 *   - readNewestAcceptedEventLogEntryOfCommand reads that row back from the database after
 *     a restart, as GET /api/v1/backup/summary does, past rows written after it.
 *   - recordBackup from an operator is refused and logged as refused, and that refused row
 *     is skipped: the newest accepted backup is still the real one.
 *
 * What these tests deliberately do not cover:
 *   - The download that sends it: modules/backup/backupDownloadRoute.test.ts.
 */
import type { SliceName } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { missingGraphicsFolderPath } from './builtGraphicsFolder.testSupport.js';
import { backupActor } from './commandActors.js';
import { createStateStore } from './createStateStore.js';

/** Opens a store on the given database, its clock held at 14:32:05 in São Paulo. */
function openStoreAt1432(database: ServerDatabase) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: missingGraphicsFolderPath,
    readCurrentTime: () => new Date('2026-11-14T17:32:05.000Z'),
  });
}

/** The recordBackup of a 48 MB zip with the recordings in it, made at 14:32. */
const backupAt1432 = {
  type: 'recordBackup',
  fileName: 'bajaovrlay-2026-11-14-1432.zip',
  sizeInBytes: 50_331_648,
  includesRecordings: true,
};

describe('recordBackup on the store', () => {
  it('writes one event-log row and changes no other slice', () => {
    // Arrange: a new store, and a listener noting which slices each change names.
    const store = openStoreAt1432(openDatabaseForTests(createTemporaryDatabasePath()));
    const slicesBefore = store.readAllSlices();
    const changedSliceNamesHeard: SliceName[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      changedSliceNamesHeard.push(changedSliceNames);
    });

    // Act: the backup records the zip it just sent.
    const outcome = store.applyCommand(backupAt1432, backupActor);

    // Assert: accepted; one new row, signed sistema:backup, with the payload and moment;
    // only the event log announced; every other slice the very same as before.
    expect(outcome, 'the backup may record its zip').toEqual({ ok: true });
    const slicesAfter = store.readAllSlices();
    const newestRow = slicesAfter.eventLog.at(-1);
    expect(newestRow, 'the row records who, what, when and how it ended').toMatchObject({
      actor: 'sistema:backup',
      command: 'recordBackup',
      ts: '2026-11-14T17:32:05.000Z',
      payload: backupAt1432,
      result: { status: 'ok' },
    });
    expect(slicesAfter.eventLog.length, 'exactly one row must be added for one backup').toBe(
      slicesBefore.eventLog.length + 1,
    );
    expect(changedSliceNamesHeard, 'listeners hear that only the event log changed').toEqual([
      ['eventLog'],
    ]);
    expect(slicesAfter.items, 'no item changes').toBe(slicesBefore.items);
    expect(slicesAfter.instances, 'nothing on air changes').toBe(slicesBefore.instances);
  });

  it('reads the newest backup row back from the database after a restart', () => {
    // Arrange: a backup recorded, then a quick-fire panel made after it; the server restarts.
    const databasePath = createTemporaryDatabasePath();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreAt1432(firstDatabase);
    storeBeforeRestart.applyCommand(backupAt1432, backupActor);
    storeBeforeRestart.applyCommand(
      { type: 'createQuickFirePanel', name: 'Bateria 2' },
      'operador:conexao-7',
    );
    firstDatabase.$client.close();
    const storeAfterRestart = openStoreAt1432(openDatabaseForTests(databasePath));

    // Act: read the newest recordBackup row.
    const newestBackupRow =
      storeAfterRestart.readNewestAcceptedEventLogEntryOfCommand('recordBackup');

    // Assert: the backup's row, past the panel written after it.
    expect(newestBackupRow, 'the newest backup row, read from the database').toMatchObject({
      command: 'recordBackup',
      payload: backupAt1432,
    });
  });

  it('refuses recordBackup from an operator, logs the refusal, and skips it when reading', () => {
    // Arrange: a new store where the backup has recorded one real copy.
    const store = openStoreAt1432(openDatabaseForTests(createTemporaryDatabasePath()));
    store.applyCommand(backupAt1432, backupActor);

    // Act: a page tries to claim a backup.
    const outcome = store.applyCommand(backupAt1432, 'operador:conexao-7');

    // Assert: refused as not allowed, and the refusal is in the event log as failed.
    expect(outcome, 'an operator may not record a backup').toMatchObject({
      ok: false,
      error: { code: 'NOT_ALLOWED' },
    });
    expect(
      store.readAllSlices().eventLog.at(-1)?.result.status,
      'the refusal is logged as failed',
    ).toBe('failed');
    expect(
      store.readNewestAcceptedEventLogEntryOfCommand('recordBackup'),
      'a refused claim is not a backup: the real copy, signed sistema:backup, is still the newest',
    ).toMatchObject({ actor: 'sistema:backup', result: { status: 'ok' } });
  });
});
