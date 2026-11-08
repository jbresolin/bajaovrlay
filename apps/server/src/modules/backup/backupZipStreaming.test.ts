/**
 * The backup zip is streamed, never built whole in memory (apps/server)
 *
 * What this module is for:
 *   A backup holds the media and a race day's recordings: hundreds of megabytes, on the
 *   stream PC, while OBS is running. streamBackupZip reads one file at a time and hands
 *   the zip out as the browser takes it, so the server holds a few chunks, not the zip.
 *
 * What these tests prove (200 MB of media on disk, a reader that takes its time, no clock):
 *   - The first bytes of the zip reach the reader before the last media file is even
 *     opened. A zip built whole before being sent would open every file first, and fail
 *     this at once: this is the CI guard that the backup streams (as BAJAOVRLAY-52's
 *     guard does for the replay).
 *   - At no moment do the bytes read from disk run more than 8 MB ahead of the bytes the
 *     reader has taken: memory stays bounded however large the media is.
 *   - Every byte arrives: the zip is the size of its parts plus its headers.
 *
 * What these tests deliberately do not cover:
 *   - What the zip holds and whether it opens: backupDownloadRoute.test.ts.
 *   - How long it takes: wall time is not a CI gate (BAJAOVRLAY-52).
 */
import { createReadStream, mkdirSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setImmediate as waitForTheNextTurn } from 'node:timers/promises';

import { describe, expect, it } from 'vitest';

import { createTemporaryDataFolder } from '../../core/boot/temporaryDataFolder.testSupport.js';
import { listFilesInFolderForTheBackup } from './backupContents.js';
import { streamBackupZip } from './backupZip.js';

const oneMegabyte = 1024 * 1024;
const mediaFileSizeInBytes = 50 * oneMegabyte;
const mediaFileNames = ['abertura.mp4', 'patrocinadores.mp4', 'podio.mp4', 'encerramento.mp4'];

// Far above what the streams buffer between them (a few 64 kB chunks), far below the
// 200 MB a zip built in memory would hold.
const mostBytesHeldBetweenDiskAndReader = 8 * oneMegabyte;

/**
 * A data folder whose media holds four videos of 50 MB each (200 MB), written as sparse
 * files so the test does not spend its time writing them; reading them is real.
 */
function createDataFolderWith200MegabytesOfMedia(): string {
  const dataFolder = createTemporaryDataFolder();
  const mediaFolder = join(dataFolder, 'media');
  mkdirSync(mediaFolder);
  for (const fileName of mediaFileNames) {
    const filePath = join(mediaFolder, fileName);
    writeFileSync(filePath, '');
    truncateSync(filePath, mediaFileSizeInBytes);
  }
  writeFileSync(join(dataFolder, 'bajaovrlay.sqlite'), 'SQLite format 3\u0000');
  return dataFolder;
}

/** What the test watches while the zip is read: the order of events, and the bytes. */
type StreamingWatch = {
  bytesReadFromDisk: number;
  bytesTakenByTheReader: number;
  mostBytesHeldAtOnce: number;
  bytesTakenWhenTheLastFileWasOpened: number | undefined;
};

describe('streamBackupZip', () => {
  it('sends the zip as it reads, holding a few megabytes at most, with 200 MB of media', async () => {
    // Arrange: 200 MB of media; a file opener that notes when each file opens and counts
    // the bytes read from disk; a reader that takes one chunk per turn of the event loop.
    const dataFolder = createDataFolderWith200MegabytesOfMedia();
    const filesFromTheDataFolder = listFilesInFolderForTheBackup(
      join(dataFolder, 'media'),
      'media',
    );
    const lastMediaFilePath = filesFromTheDataFolder.at(-1)?.pathOnDisk;
    const watch: StreamingWatch = {
      bytesReadFromDisk: 0,
      bytesTakenByTheReader: 0,
      mostBytesHeldAtOnce: 0,
      bytesTakenWhenTheLastFileWasOpened: undefined,
    };
    const openFileAndCountItsBytes = (pathOnDisk: string) => {
      if (pathOnDisk === lastMediaFilePath) {
        watch.bytesTakenWhenTheLastFileWasOpened = watch.bytesTakenByTheReader;
      }
      // Counted as each chunk passes through, without a 'data' listener on the file
      // itself, which would make it flow regardless of how fast the zip takes it.
      const countTheBytesRead = new Transform({
        transform(chunk: Buffer, _encoding, passTheChunkOn) {
          watch.bytesReadFromDisk += chunk.length;
          const bytesHeldNow = watch.bytesReadFromDisk - watch.bytesTakenByTheReader;
          watch.mostBytesHeldAtOnce = Math.max(watch.mostBytesHeldAtOnce, bytesHeldNow);
          passTheChunkOn(null, chunk);
        },
      });
      return createReadStream(pathOnDisk).pipe(countTheBytesRead);
    };
    const slowReader = new Writable({
      write(chunk: Buffer, _encoding, takeTheNextChunk) {
        watch.bytesTakenByTheReader += chunk.length;
        void waitForTheNextTurn().then(() => takeTheNextChunk());
      },
    });

    // Act: stream the backup of that folder into the slow reader, to its end.
    const zipStream = streamBackupZip(
      {
        databaseCopyPath: join(dataFolder, 'bajaovrlay.sqlite'),
        readMeText: 'Cópia de segurança do BajaOvrLay.',
        filesFromTheDataFolder,
      },
      openFileAndCountItsBytes,
    );
    await pipeline(zipStream, slowReader);

    // Assert: the reader had the first three videos before the fourth was opened; the
    // bytes held at once stayed under 8 MB; and the whole 200 MB arrived.
    expect(
      watch.bytesTakenWhenTheLastFileWasOpened,
      'the first three videos must have reached the reader before the last one is opened',
    ).toBeGreaterThanOrEqual(3 * mediaFileSizeInBytes);
    expect(
      watch.mostBytesHeldAtOnce,
      'the bytes read from disk must never run more than 8 MB ahead of the reader',
    ).toBeLessThan(mostBytesHeldBetweenDiskAndReader);
    expect(
      watch.bytesTakenByTheReader,
      'every byte of the four videos must reach the reader, with the zip headers on top',
    ).toBeGreaterThan(4 * mediaFileSizeInBytes);
  });
});
