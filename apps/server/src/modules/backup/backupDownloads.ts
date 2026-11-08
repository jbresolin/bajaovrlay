// The backup download (BAJAOVRLAY-33): one zip of the data folder at a time, recorded in
// the event log once it went out whole. The route (api.ts) calls this.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline, type Readable, Transform } from 'node:stream';

import {
  type BackupSummary,
  readBackupOfEventLogEntry,
  type RecordBackupCommand,
} from '@bajaovrlay/shared';

import { copyDatabaseIntoFile } from '../../core/db/databaseBackup.js';
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
  /** Where the temporary copy of the database is made; the system's when left out. */
  temporaryFolder?: string | undefined;
  /** How each file is opened for the zip; tests watch it. fs.createReadStream when left out. */
  openFileForReading?: OpenFileForReading | undefined;
};

/** How asking for a backup ends: its zip, being made as it is read, or refused. */
export type BackupDownloadStart =
  | { isStarted: true; fileName: string; zipStream: Readable }
  | { isStarted: false; reason: 'alreadyRunning' };

/** The backup downloads of one server. */
export type BackupDownloads = {
  /**
   * Starts a backup: copies the database, then hands back the zip as a stream to read.
   * Refused while another backup's zip has not closed. Rejects when the database cannot
   * be copied.
   */
  startBackupDownload: (isIncludingRecordings: boolean) => Promise<BackupDownloadStart>;
  /** The size of each part on disk now, the newest backup in the event log, and whether one runs. */
  summarizeTheBackup: () => BackupSummary;
};

/** Creates the backup downloads of one server; nothing runs until one is asked for. */
export function createBackupDownloads(options: BackupDownloadsOptions): BackupDownloads {
  const readCurrentTime = options.readCurrentTime ?? (() => new Date());
  const temporaryFolder = options.temporaryFolder ?? tmpdir();
  const mediaFolder = buildMediaFolderPath(options.dataFolder);
  const recordingsFolder = buildRecordingsFolderPath(options.dataFolder);
  const openFileForReading = options.openFileForReading ?? openFileFromDisk;
  // Set before the first await, so two requests arriving together cannot both start.
  let isABackupRunning = false;

  async function startBackupDownload(isIncludingRecordings: boolean): Promise<BackupDownloadStart> {
    if (isABackupRunning) {
      return { isStarted: false, reason: 'alreadyRunning' };
    }
    isABackupRunning = true;
    const madeAt = readCurrentTime();
    const fileName = nameBackupZipFile(madeAt);
    const temporaryCopyFolder = mkdtempSync(join(temporaryFolder, 'bajaovrlay-copia-'));
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
      await copyDatabaseIntoFile(options.databasePath, databaseCopyPath);
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
      throw startError;
    }

    // Counted as the bytes pass on to the reader; by the 'end' the reader has taken every
    // one, so the size in the event log is the size of the file the browser saved.
    let bytesSent = 0;
    let isSentWhole = false;
    const countedZipStream = new Transform({
      transform(chunk: Buffer, _encoding, passTheChunkOn) {
        bytesSent += chunk.length;
        passTheChunkOn(null, chunk);
      },
    });
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
      for (const fileStream of filesOpened) {
        fileStream.destroy();
      }
      rmSync(temporaryCopyFolder, { recursive: true, force: true });
      isABackupRunning = false;
      if (isSentWhole) {
        recordTheFinishedBackup({ fileName, sizeInBytes: bytesSent, isIncludingRecordings });
      }
    });
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
