/**
 * One backup download at a time, and what each one leaves behind (apps/server)
 *
 * What this module is for:
 *   createBackupDownloads runs the backup the route serves (BAJAOVRLAY-33): it copies the
 *   database into a temporary file with SQLite's online backup, streams the zip, and once
 *   the last byte was taken it records the copy with recordBackup, signed
 *   `sistema:backup`. Only one runs at a time: two copies at once would each slow the
 *   other on the stream PC's disk, during the break.
 *
 * What these tests prove (a real store on a real SQLite file, the zip read by hand):
 *   - While a backup has not been read to its end, a second one is refused; once the
 *     first ended, the next one starts.
 *   - A finished backup writes one event-log row with the size actually sent, and its
 *     temporary copy of the database is gone.
 *   - A backup stopped half-way (the browser's download cancelled) writes no row, removes
 *     its temporary copy, and lets the next one start.
 *   - A database that stays locked through every try of the copy refuses the backup with
 *     that reason, leaves no temporary copy, and lets the next one start.
 *
 * What these tests deliberately do not cover:
 *   - The zip's contents and the HTTP answers: backupDownloadRoute.test.ts.
 *   - That the zip streams: backupZipStreaming.test.ts.
 */
import { once } from 'node:events';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

import Database from 'better-sqlite3';
import { describe, expect, it, onTestFinished } from 'vitest';

import { buildBootOptions } from '../../core/boot/bootedServer.testSupport.js';
import { startServer } from '../../core/boot/startServer.js';
import { createTemporaryDataFolder } from '../../core/boot/temporaryDataFolder.testSupport.js';
import { committedMigrationsFolder } from '../../core/db/openDatabase.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createBackupDownloads } from './backupDownloads.js';

/** Reads a zip stream to its end and answers how many bytes it had. */
async function readTheZipToItsEnd(zipStream: Readable): Promise<number> {
  let bytesRead = 0;
  for await (const chunk of zipStream) {
    bytesRead += (chunk as Buffer).length;
  }
  return bytesRead;
}

/**
 * Resolves at the stream's 'close' event, whether it ended or was stopped: the backup
 * finishes its work (the row, the clean-up) there. Called before the read or the stop,
 * so the event cannot pass unseen.
 */
async function waitForTheCloseEvent(stream: Readable): Promise<void> {
  await once(stream, 'close');
}

/**
 * A booted server with a logo in its media, and the backup downloads on it, their
 * temporary copies made in a folder of their own the test can look into; the clock is
 * held at 14:32 in São Paulo.
 */
async function startServerWithBackupDownloads(
  waitsBetweenDatabaseCopyTriesInMs?: readonly number[],
) {
  const bootOptions = buildBootOptions(committedMigrationsFolder);
  const runningServer = await startServer(bootOptions);
  onTestFinished(() => runningServer.close());
  writeFileSync(join(bootOptions.dataFolder, 'media', 'logo-baja-ufpr.png'), 'logo da equipe 42');
  const temporaryFolder = join(createTemporaryDataFolder(), 'copias-temporarias');
  mkdirSync(temporaryFolder);
  const backupDownloads = createBackupDownloads({
    stateStore: runningServer.stateStore,
    logger: createLogger({ level: 'silent' }),
    databasePath: bootOptions.databasePath,
    dataFolder: bootOptions.dataFolder,
    version: '0.3.1',
    readCurrentTime: () => new Date('2026-11-14T17:32:00.000Z'),
    temporaryFolder,
    waitsBetweenDatabaseCopyTriesInMs,
  });
  return { runningServer, bootOptions, backupDownloads, temporaryFolder };
}

describe('createBackupDownloads', () => {
  it('refuses a second backup while the first is still being read, and starts one after', async () => {
    // Arrange: a first backup started, its zip not read yet.
    const { backupDownloads } = await startServerWithBackupDownloads();
    const firstBackup = await backupDownloads.startBackupDownload(true);
    if (!firstBackup.isStarted) {
      throw new Error('the first backup must start');
    }

    // Act: ask for a second while the first runs; then read the first to its end and ask
    // for a third.
    const secondBackup = await backupDownloads.startBackupDownload(true);
    const firstClosing = waitForTheCloseEvent(firstBackup.zipStream);
    await readTheZipToItsEnd(firstBackup.zipStream);
    await firstClosing;
    const thirdBackup = await backupDownloads.startBackupDownload(true);

    // Assert: the second refused as already running; the third started.
    expect(secondBackup, 'one backup at a time').toEqual({
      isStarted: false,
      reason: 'alreadyRunning',
    });
    expect(thirdBackup.isStarted, 'once the first ended, the next one starts').toBe(true);
  });

  it('records a finished backup with the size sent, and removes its temporary copy', async () => {
    // Arrange: a backup started.
    const { runningServer, backupDownloads, temporaryFolder } =
      await startServerWithBackupDownloads();
    const backup = await backupDownloads.startBackupDownload(false);
    if (!backup.isStarted) {
      throw new Error('the backup must start');
    }

    // Act: read the zip to its end, as the browser does.
    const closing = waitForTheCloseEvent(backup.zipStream);
    const bytesSent = await readTheZipToItsEnd(backup.zipStream);
    await closing;

    // Assert: one row signed sistema:backup with the name, the size sent and no
    // recordings; the temporary folder is empty again.
    const newestRow = runningServer.stateStore.readAllSlices().eventLog.at(-1);
    expect(newestRow, 'the finished backup is in the event log').toMatchObject({
      actor: 'sistema:backup',
      command: 'recordBackup',
      payload: {
        fileName: 'bajaovrlay-2026-11-14-1432.zip',
        sizeInBytes: bytesSent,
        includesRecordings: false,
      },
      result: { status: 'ok' },
    });
    expect(backup.fileName, 'the name the browser saves').toBe('bajaovrlay-2026-11-14-1432.zip');
    expect(readdirSync(temporaryFolder), 'the temporary database copy must be gone').toEqual([]);
  });

  it('writes no row for a backup stopped half-way, removes its copy, and lets the next start', async () => {
    // Arrange: a backup started, and the number of event-log rows before it.
    const { runningServer, backupDownloads, temporaryFolder } =
      await startServerWithBackupDownloads();
    const rowCountBefore = runningServer.stateStore.readAllSlices().eventLog.length;
    const backup = await backupDownloads.startBackupDownload(true);
    if (!backup.isStarted) {
      throw new Error('the backup must start');
    }

    // Act: the browser's download is cancelled before the end; then a new backup is asked for.
    const closing = waitForTheCloseEvent(backup.zipStream);
    backup.zipStream.destroy();
    await closing;
    const nextBackup = await backupDownloads.startBackupDownload(true);

    // Assert: no new row, no temporary copy left of the stopped one, and the next started.
    expect(
      runningServer.stateStore.readAllSlices().eventLog.length,
      'a copy never finished must not show as "Última cópia"',
    ).toBe(rowCountBefore);
    expect(nextBackup.isStarted, 'a stopped backup must not block the next one').toBe(true);
    const foldersLeft = readdirSync(temporaryFolder);
    expect(foldersLeft, 'only the next backup’s temporary copy may be there').toHaveLength(1);
  });

  it('refuses the backup when the database stays locked, keeping nothing and blocking nothing', async () => {
    // Arrange: a server whose database another connection holds locked (as a write being
    // committed would, but for good), and copies that try three times, 10 ms apart.
    const { bootOptions, backupDownloads, temporaryFolder } =
      await startServerWithBackupDownloads([10, 10]);
    const lockingConnection = new Database(bootOptions.databasePath);
    lockingConnection.exec('BEGIN EXCLUSIVE');
    onTestFinished(() => {
      lockingConnection.close();
    });

    // Act: ask for a backup while it is locked; then release the lock and ask again.
    const lockedBackup = await backupDownloads.startBackupDownload(true);
    const temporaryFoldersAfterTheRefusal = readdirSync(temporaryFolder);
    lockingConnection.exec('ROLLBACK');
    const nextBackup = await backupDownloads.startBackupDownload(true);

    // Assert: refused as locked, nothing left in the temporary folder, and the next one
    // started once the lock was gone.
    expect(lockedBackup, 'a copy that could not be made must refuse the backup').toEqual({
      isStarted: false,
      reason: 'databaseStayedLocked',
    });
    expect(temporaryFoldersAfterTheRefusal, 'the refused backup leaves no folder').toEqual([]);
    expect(nextBackup.isStarted, 'a refused backup must not block the next one').toBe(true);
  });
});
