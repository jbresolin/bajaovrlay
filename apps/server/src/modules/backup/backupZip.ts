// Writing the backup zip as a stream, with yazl: plain JavaScript (no native part to build
// in the image), it reads one file at a time and waits for the reader, so the zip is never
// whole in memory, and it switches to ZIP64 by itself for a file over 4 GB (a day of
// recordings can be).
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';

import yazl from 'yazl';

import type { FileInTheBackup } from './backupContents.js';

/** The name the database has in the zip: the name the stream PC's data folder gives it. */
export const databaseNameInTheZip = 'bajaovrlay.sqlite';

/** The name of the text that says what the zip holds. */
export const readMeNameInTheZip = 'leia-me.txt';

/** What one backup zip holds. */
export type BackupZipContents = {
  /** The consistent copy of the database (copyDatabaseIntoFile), not the live file. */
  databaseCopyPath: string;
  readMeText: string;
  /** The media and, when ticked, the recordings, in the order they go into the zip. */
  filesFromTheDataFolder: FileInTheBackup[];
};

/** Opens one file for the zip; tests pass one that watches what is read and when. */
export type OpenFileForReading = (pathOnDisk: string) => Readable;

/** Opens a file from disk, as a stream read 64 kB at a time. */
export function openFileFromDisk(pathOnDisk: string): Readable {
  return createReadStream(pathOnDisk);
}

// Stored, not compressed. The images and videos are compressed already; the expected size
// the dialog shows is then the zip's size, which the operator checks against the stick;
// and deflate would take a core from OBS during the break. The cost: a race day's
// recordings (JSON text) would be several times smaller compressed.
const storedNotCompressed = { compress: false };

/**
 * The backup zip as a stream: bajaovrlay.sqlite, leia-me.txt, then each file of the data
 * folder, each opened only when its turn comes, so one file is open at a time.
 */
export function streamBackupZip(
  contents: BackupZipContents,
  openFileForReading: OpenFileForReading = openFileFromDisk,
): Readable {
  const zipFile = new yazl.ZipFile();
  // A PassThrough in yazl's code; @types/yazl only promises NodeJS.ReadableStream.
  const zipOutput = zipFile.outputStream as Readable;
  // yazl reports its own failures on the ZipFile, not on the stream, and listens to no
  // error of a stream handed to addReadStreamLazy. Both are passed on to the zip's stream,
  // so a file that cannot be read (a recording deleted meanwhile, the copy removed after a
  // cancelled download) ends that download instead of crashing the server.
  const stopTheZip = (zipError: Error) => {
    zipOutput.destroy(zipError);
  };
  zipFile.on('error', stopTheZip);
  const openFileForTheZip = (pathOnDisk: string): Readable => {
    const fileStream = openFileForReading(pathOnDisk);
    fileStream.once('error', stopTheZip);
    return fileStream;
  };
  zipFile.addReadStreamLazy(databaseNameInTheZip, storedNotCompressed, (handTheStreamOver) => {
    handTheStreamOver(null, openFileForTheZip(contents.databaseCopyPath));
  });
  zipFile.addBuffer(Buffer.from(contents.readMeText, 'utf8'), readMeNameInTheZip, {
    compress: false,
  });
  for (const file of contents.filesFromTheDataFolder) {
    // No `size` given: a recording still being written grows while the zip is made, and
    // yazl would refuse a file whose size changed. The zip takes what is there when read.
    zipFile.addReadStreamLazy(file.pathInTheZip, storedNotCompressed, (handTheStreamOver) => {
      handTheStreamOver(null, openFileForTheZip(file.pathOnDisk));
    });
  }
  zipFile.end();
  return zipOutput;
}
