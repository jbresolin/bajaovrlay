/**
 * Chaos: a backup downloaded in the middle of the show (apps/control, Playwright)
 *
 * What this module is for:
 *   "Cópia de segurança" (BAJAOVRLAY-33) copies the SQLite database while the show runs.
 *   Its last step holds a read lock while it copies what is left, and the server's writes
 *   wait for it: databaseBackup.ts documents that pause, bounded by the database's 5 s busy
 *   timeout (a write waiting longer would fail). A take is a write. The promise: takes go
 *   on during a backup, none fails, and none waits longer than that documented pause.
 *
 * What these tests prove:
 *   - With takes sent one after another for as long as a backup download runs (two lower
 *     thirds alternating, as an operator taking interviews), every take is applied, every
 *     answer comes back under the 5 s busy timeout, at least five came back while the zip
 *     was still downloading, and the zip arrives whole (a zip's end-of-archive record ends
 *     it). The data folder holds 100 MB of video (sparse files, as the backup's own
 *     streaming test makes them), so the download lasts. The slowest answer and the count
 *     are written on the test's report.
 *
 * What these tests deliberately do not cover:
 *   - The zip's contents and a restore: backupDownload.e2e.ts unzips one and opens its
 *     database; databaseBackup.test.ts proves the copy is consistent.
 *   - A database of gigabytes, where the pause would pass 5 s (databaseBackup.ts says so,
 *     and that the event log must be pruned long before).
 */
import { mkdirSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { type ChaosServer, startChaosServer } from './faults/serverProcess';
import { chaosServerPort } from './steps/chaosPorts';
import { openTheProgramOutputAt } from './steps/pagesOfTheShow';
import { makeLowerThirdButton, sendCommandToTheServerOnPort } from './steps/showOnTheChaosServer';

// The database's busy timeout: the longest a write may wait for the backup's read lock
// before it fails (databaseBackup.ts). No take may wait longer.
const documentedLongestPauseInMilliseconds = 5_000;
// Takes made before the backup starts, so the database and its event log hold a show's
// worth of rows to copy, and the least number made during it.
const takesBeforeTheBackup = 200;
const leastTakesWhileTheZipDownloads = 5;
// The videos a show's media folder holds, written sparse: their size costs no disk, but
// the backup reads and zips every byte, so the download lasts long enough to take during.
const videoFileNames = ['abertura.mp4', 'podio.mp4'];
const videoFileSizeInBytes = 50 * 1024 * 1024;

/** The four bytes that start a zip's end-of-central-directory record ("PK\x05\x06"). */
const endOfZipRecordSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

test.describe('a backup downloaded while takes run', () => {
  test('applies every take, none waiting past the documented pause, and the zip arrives whole', async ({
    context,
  }, testInfo) => {
    let server: ChaosServer | undefined;
    try {
      // Arrange: two lower thirds, taken in turn 200 times, so the database has rows to copy.
      server = await startChaosServer('backupWhileTakes', chaosServerPort);
      const itemIds = [
        await makeLowerThirdButton(server.port, 'Tarja — capitã da UFPR', 'Ana Souza'),
        await makeLowerThirdButton(server.port, 'Tarja — chefe da UFSC', 'Bruno Lima'),
      ];
      for (let takeNumber = 0; takeNumber < takesBeforeTheBackup; takeNumber += 1) {
        await sendCommandToTheServerOnPort(server.port, {
          type: 'takeItem',
          itemId: itemIds[takeNumber % 2],
        });
      }
      await openTheProgramOutputAt(context, server.address);
      const mediaFolder = join(server.dataFolder, 'media');
      mkdirSync(mediaFolder, { recursive: true });
      for (const fileName of videoFileNames) {
        const videoPath = join(mediaFolder, fileName);
        writeFileSync(videoPath, '');
        truncateSync(videoPath, videoFileSizeInBytes);
      }

      // Act: the backup download starts, recordings included; takes go on, one after the
      // other, timed from send to answer, until the zip has arrived.
      let hasTheZipArrived = false;
      let takesAnsweredWhileTheZipDownloads = 0;
      const zipDownload = fetch(`${server.address}/api/v1/backup?includeRecordings=true`)
        .then((response) => response.arrayBuffer())
        .then((zipBytes) => {
          hasTheZipArrived = true;
          return Buffer.from(zipBytes);
        });
      const answerTimesInMilliseconds: number[] = [];
      const refusedTakes: string[] = [];
      while (!hasTheZipArrived) {
        const sentAtMs = performance.now();
        const answer = await sendCommandToTheServerOnPort(server.port, {
          type: 'takeItem',
          itemId: itemIds[answerTimesInMilliseconds.length % 2],
        });
        answerTimesInMilliseconds.push(performance.now() - sentAtMs);
        if (!hasTheZipArrived) {
          takesAnsweredWhileTheZipDownloads += 1;
        }
        if (!answer.ok) {
          refusedTakes.push(answer.errorCode ?? 'no code');
        }
      }
      const zipBytes = await zipDownload;

      // Assert: takes ran during the download, none refused, none slower than the
      // documented pause, and the zip whole.
      const slowestAnswerInMilliseconds = Math.max(...answerTimesInMilliseconds);
      testInfo.annotations.push({
        type: 'measured',
        description: `${String(takesAnsweredWhileTheZipDownloads)} takes answered while the zip downloaded; the slowest answered in ${slowestAnswerInMilliseconds.toFixed(0)} ms; the zip is ${String(zipBytes.length)} bytes`,
      });
      expect(
        takesAnsweredWhileTheZipDownloads,
        'takes must have run while the backup was downloading, or this proves nothing',
      ).toBeGreaterThanOrEqual(leastTakesWhileTheZipDownloads);
      expect(refusedTakes, 'no take may fail during a backup').toEqual([]);
      expect(
        slowestAnswerInMilliseconds,
        'no take may wait past the database busy timeout the backup documents',
      ).toBeLessThan(documentedLongestPauseInMilliseconds);
      expect(
        zipBytes.lastIndexOf(endOfZipRecordSignature),
        'the zip must arrive whole, ending with its end-of-archive record',
      ).toBe(zipBytes.length - 22);
    } finally {
      await server?.stop();
    }
  });
});
