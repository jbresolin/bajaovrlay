// The backup download (BAJAOVRLAY-33): one zip of the data folder at a time, recorded in
// the event log once it went out whole. The route (api.ts) calls this.
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline, type Readable, Transform } from 'node:stream';

import {
  type BackupSummary,
  readBackupOfEventLogEntry,
  type RecordBackupCommand,
} from '@bajaovrlay/shared';

import { copyDatabaseIntoFile, DatabaseStayedLockedError } from '../../core/db/databaseBackup.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import { backupActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { buildRecordingsFolderPath } from '../dataSources/index.js';
import { buildMediaFolderPath } from '../media/index.js';
import { listFilesInFolderForTheBackup, measureTheBackupParts } from './backupContents.js';
import { nameBackupZipFile } from './backupFileName.js';
import { writeBackupReadMe } from './backupReadMe.js';
import {
  databaseNameInTheZip,
  type OpenFileForReading,
  openFileFromDisk,
  streamBackupZip,
} from './backupZip.js';
import {
  makeTemporaryDatabaseCopyFolder,
  removeTemporaryCopiesOfStoppedServers,
} from './temporaryDatabaseCopies.js';

/**
 * How long a backup may go with no byte taken by its reader before it is stopped: a
 * browser that stalls, or a connection gone without the HTTP server noticing, would
 * otherwise hold "one backup at a time" until a restart. A minute is far beyond any pause
 * of a browser saving to a USB stick.
 */
export const idleTimeOfAStalledBackupInMs = 60_000;

/** What the backup needs: the store, where the data is, and what goes in leia-me.txt. */
export type BackupDownloadsOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  databasePath: string;
  /** DATA_DIR: its media and recordings folders go into the zip. */
  dataFolder: string;
  /** The BajaOvrLay version leia-me.txt names. */
  version: string;
  /** The clock that names the zip; the machine's when left out. */
  readCurrentTime?: (() => Date) | undefined;
  /**
   * Where the temporary copy of the database is made; the system's when left out. Copies
   * left there by servers no longer running are removed when the downloads are created.
   */
  temporaryFolder?: string | undefined;
  /** How each file is opened for the zip; tests watch it. fs.createReadStream when left out. */
  openFileForReading?: OpenFileForReading | undefined;
  /** The waits between tries of a database copy that met a lock; about 5.5 s when left out. */
  waitsBetweenDatabaseCopyTriesInMs?: readonly number[] | undefined;
};

/** How asking for a backup ends: its zip, being made as it is read, or refused. */
export type BackupDownloadStart =
  | { isStarted: true; fileName: string; zipStream: Readable }
  | { isStarted: false; reason: 'alreadyRunning' | 'databaseStayedLocked' };

/** The backup downloads of one server. */
export type BackupDownloads = {
  /**
   * Starts a backup: copies the database, then hands back the zip as a stream to read.
   * Refused while another backup's zip has not closed, or when the database stayed locked
   * through every try of the copy. Rejects when the database cannot be copied otherwise.
   * `cancelSignal` is the request's: once it aborts, the zip is stopped.
   */
  startBackupDownload: (
    isIncludingRecordings: boolean,
    cancelSignal?: AbortSignal,
  ) => Promise<BackupDownloadStart>;
  /** The size of each part on disk now, the newest backup in the event log, and whether one runs. */
  summarizeTheBackup: () => BackupSummary;
};

/**
 * Creates the backup downloads of one server, first removing the temporary copies servers
 * killed mid-backup left behind; nothing else runs until a backup is asked for.
 */
export function createBackupDownloads(options: BackupDownloadsOptions): BackupDownloads {
  const readCurrentTime = options.readCurrentTime ?? (() => new Date());
  const temporaryFolder = options.temporaryFolder ?? tmpdir();
  const mediaFolder = buildMediaFolderPath(options.dataFolder);
  const recordingsFolder = buildRecordingsFolderPath(options.dataFolder);
  const openFileForReading = options.openFileForReading ?? openFileFromDisk;
  // A boot must not fail over a folder it cannot clear (another user's, in a shared /tmp).
  try {
    removeTemporaryCopiesOfStoppedServers(temporaryFolder);
  } catch (sweepError) {
    options.logger.warn(
      { err: sweepError, temporary_folder: temporaryFolder },
      'could not remove the backup copies left behind',
    );
  }
  // Set before the first await, so two requests arriving together cannot both start.
  let isABackupRunning = false;

  async function startBackupDownload(
    isIncludingRecordings: boolean,
    cancelSignal?: AbortSignal,
  ): Promise<BackupDownloadStart> {
    if (isABackupRunning) {
      return { isStarted: false, reason: 'alreadyRunning' };
    }
    isABackupRunning = true;
    const madeAt = readCurrentTime();
    const fileName = nameBackupZipFile(madeAt);
    const temporaryCopyFolder = makeTemporaryDatabaseCopyFolder(temporaryFolder);
    // Every file the zip opened, closed when the backup closes: a download cancelled
    // half-way must not leave a file open until the process ends.
    const filesOpened: Readable[] = [];
    const openFileAndRememberIt: OpenFileForReading = (pathOnDisk) => {
      const fileStream = openFileForReading(pathOnDisk);
      filesOpened.push(fileStream);
      return fileStream;
    };

    let zipStream: Readable;
    try {
      const databaseCopyPath = join(temporaryCopyFolder, databaseNameInTheZip);
      await copyDatabaseIntoFile(options.databasePath, databaseCopyPath, {
        waitsBetweenTriesInMs: options.waitsBetweenDatabaseCopyTriesInMs,
      });
      const mediaFiles = listFilesInFolderForTheBackup(mediaFolder, 'media');
      const recordingFiles = isIncludingRecordings
        ? listFilesInFolderForTheBackup(recordingsFolder, 'recordings')
        : [];
      const readMeText = writeBackupReadMe({
        madeAt,
        version: options.version,
        mediaFileCount: mediaFiles.length,
        recordingFileCount: isIncludingRecordings ? recordingFiles.length : undefined,
      });
      zipStream = streamBackupZip(
        {
          databaseCopyPath,
          readMeText,
          filesFromTheDataFolder: [...mediaFiles, ...recordingFiles],
        },
        openFileAndRememberIt,
      );
    } catch (startError) {
      rmSync(temporaryCopyFolder, { recursive: true, force: true });
      isABackupRunning = false;
      if (startError instanceof DatabaseStayedLockedError) {
        return { isStarted: false, reason: 'databaseStayedLocked' };
      }
      throw startError;
    }

    // Counted as the bytes pass on to the reader; by the 'end' the reader has taken every
    // one, so the size in the event log is the size of the file the browser saved.
    let bytesSent = 0;
    let isSentWhole = false;
    const countedZipStream = new Transform({
      transform(chunk: Buffer, _encoding, passTheChunkOn) {
        bytesSent += chunk.length;
        restartTheIdleTimer();
        passTheChunkOn(null, chunk);
      },
    });
    // Restarted at every chunk that moves on to the reader. A reader that stops taking
    // bytes stops the chunks too (the stream's buffers fill), so the timer runs out.
    let idleTimer = setTimeout(stopTheStalledBackup, idleTimeOfAStalledBackupInMs);
    function restartTheIdleTimer(): void {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(stopTheStalledBackup, idleTimeOfAStalledBackupInMs);
    }
    function stopTheStalledBackup(): void {
      countedZipStream.destroy(new Error('no byte of the backup was taken for a minute'));
    }
    // pipeline stops the zip when the reader goes away (the download was cancelled), and
    // stops the reader when the zip fails (a file vanished); either way, 'close' follows.
    pipeline(zipStream, countedZipStream, (zipError) => {
      if (zipError !== undefined && zipError !== null && !isSentWhole) {
        options.logger.warn({ err: zipError, file_name: fileName }, 'backup download stopped');
      }
    });
    countedZipStream.once('end', () => {
      isSentWhole = true;
    });
    countedZipStream.once('close', () => {
      clearTimeout(idleTimer);
      cancelSignal?.removeEventListener('abort', stopTheCancelledBackup);
      for (const fileStream of filesOpened) {
        fileStream.destroy();
      }
      rmSync(temporaryCopyFolder, { recursive: true, force: true });
      isABackupRunning = false;
      if (isSentWhole) {
        recordTheFinishedBackup({ fileName, sizeInBytes: bytesSent, isIncludingRecordings });
      }
    });

    // The client may have hung up while the database was being copied. The HTTP server
    // then neither reads nor cancels the answer (@hono/node-server skips the body of a
    // socket already closed), so nothing would ever close the zip: it is stopped here.
    function stopTheCancelledBackup(): void {
      countedZipStream.destroy(new Error('the client hung up before the backup was sent'));
    }
    if (cancelSignal?.aborted === true) {
      stopTheCancelledBackup();
    } else {
      cancelSignal?.addEventListener('abort', stopTheCancelledBackup, { once: true });
    }
    return { isStarted: true, fileName, zipStream: countedZipStream };
  }

  /** Writes the finished backup's event-log row, through the one command path. */
  function recordTheFinishedBackup(backup: {
    fileName: string;
    sizeInBytes: number;
    isIncludingRecordings: boolean;
  }): void {
    const command: RecordBackupCommand = {
      type: 'recordBackup',
      fileName: backup.fileName,
      sizeInBytes: backup.sizeInBytes,
      includesRecordings: backup.isIncludingRecordings,
    };
    const outcome = options.stateStore.applyCommand(command, backupActor);
    if (!outcome.ok) {
      options.logger.error({ error: outcome.error }, 'the finished backup could not be recorded');
      return;
    }
    options.logger.info(
      { file_name: backup.fileName, size_in_bytes: backup.sizeInBytes },
      'backup downloaded',
    );
  }

  function summarizeTheBackup(): BackupSummary {
    const sizes = measureTheBackupParts({
      databasePath: options.databasePath,
      mediaFolder,
      recordingsFolder,
    });
    const newestRow = options.stateStore.readNewestAcceptedEventLogEntryOfCommand('recordBackup');
    const latestBackup = newestRow === undefined ? undefined : readBackupOfEventLogEntry(newestRow);
    return { ...sizes, latestBackup: latestBackup ?? null, isABackupRunning };
  }

  return { startBackupDownload, summarizeTheBackup };
}
