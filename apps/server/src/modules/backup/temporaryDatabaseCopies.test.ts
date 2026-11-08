/**
 * The temporary folders of the backup's database copies (apps/server)
 *
 * What this module is for:
 *   Each backup copies the database into a folder of its own in the system's temporary
 *   folder, removed when the zip closes. A server that is killed mid-backup (the stream PC
 *   switched off, Docker restarted) never gets there, and a 200 MB copy stays behind in
 *   the container's /tmp. So the folder carries the server's process id, and every boot
 *   removes the folders of servers that are no longer running, and its own from before a
 *   restart (in Docker the server comes back with the same id).
 *
 * What these tests prove (real folders in a temporary folder, real process ids):
 *   - A copy's folder is named bajaovrlay-copia-<process id>-…, and is empty.
 *   - The sweep removes the folder of a process that has ended and this process's own,
 *     and keeps the folder of a process still running (another server on the same
 *     machine, mid-backup) and anything not named as a copy's folder.
 *
 * What these tests deliberately do not cover:
 *   - That the boot runs the sweep: backupDownloadRoute.test.ts.
 *   - The copy inside the folder: backupDownloads.test.ts.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDataFolder } from '../../core/boot/temporaryDataFolder.testSupport.js';
import {
  makeTemporaryDatabaseCopyFolder,
  removeTemporaryCopiesOfStoppedServers,
} from './temporaryDatabaseCopies.js';

/** The process id of a process that ran and has ended: a server that is gone. */
function findTheIdOfAnEndedProcess(): number {
  const endedProcess = spawnSync(process.execPath, ['--eval', '']);
  if (endedProcess.pid === undefined) {
    throw new Error('the short-lived process must have started');
  }
  return endedProcess.pid;
}

/** Makes a copy's folder by hand, as a server of the given process id named it, with a copy in it. */
function makeCopyFolderOfProcess(temporaryFolder: string, processId: number): string {
  const folderPath = join(temporaryFolder, `bajaovrlay-copia-${String(processId)}-Xk3pQa`);
  mkdirSync(folderPath);
  writeFileSync(join(folderPath, 'bajaovrlay.sqlite'), 'cópia do banco de dados');
  return folderPath;
}

describe('makeTemporaryDatabaseCopyFolder', () => {
  it('makes an empty folder named after this server’s process id', () => {
    // Arrange: an empty temporary folder.
    const temporaryFolder = createTemporaryDataFolder();

    // Act: make the folder of a copy.
    const folderPath = makeTemporaryDatabaseCopyFolder(temporaryFolder);

    // Assert: one empty folder, named bajaovrlay-copia-<process id>-….
    expect(readdirSync(temporaryFolder), 'one folder, in the temporary folder').toHaveLength(1);
    expect(folderPath, 'named after this process').toContain(
      join(temporaryFolder, `bajaovrlay-copia-${String(process.pid)}-`),
    );
    expect(readdirSync(folderPath), 'empty, until the copy is made').toEqual([]);
  });
});

describe('removeTemporaryCopiesOfStoppedServers', () => {
  it('removes the copies of ended servers and its own, and keeps the rest', () => {
    // Arrange: a temporary folder holding the copy of a server that ended, one of this
    // process from before a restart, one of a process still running (the test runner
    // that started this one), and a folder and a file of something else.
    const temporaryFolder = createTemporaryDataFolder();
    const copyOfAnEndedServer = makeCopyFolderOfProcess(
      temporaryFolder,
      findTheIdOfAnEndedProcess(),
    );
    const copyOfThisServerBeforeARestart = makeCopyFolderOfProcess(temporaryFolder, process.pid);
    const copyOfAServerStillRunning = makeCopyFolderOfProcess(temporaryFolder, process.ppid);
    mkdirSync(join(temporaryFolder, 'vite-cache'));
    writeFileSync(join(temporaryFolder, 'bajaovrlay-copia-anotacoes.txt'), 'não é uma cópia');

    // Act: sweep, as a boot does.
    removeTemporaryCopiesOfStoppedServers(temporaryFolder);

    // Assert: the two stale copies are gone; the running server's copy and the
    // unrelated folder and file are untouched.
    expect(existsSync(copyOfAnEndedServer), 'a copy whose server ended is removed').toBe(false);
    expect(
      existsSync(copyOfThisServerBeforeARestart),
      'a copy of this process id, before this boot, is removed',
    ).toBe(false);
    expect(
      existsSync(copyOfAServerStillRunning),
      'another running server may be mid-backup: its copy is kept',
    ).toBe(true);
    expect(readdirSync(temporaryFolder).sort(), 'nothing else is touched').toEqual([
      `bajaovrlay-copia-${String(process.ppid)}-Xk3pQa`,
      'bajaovrlay-copia-anotacoes.txt',
      'vite-cache',
    ]);
  });

  it('does nothing when the temporary folder does not exist', () => {
    // Arrange: a temporary folder path with nothing there.
    const missingFolder = join(createTemporaryDataFolder(), 'nao-existe');

    // Act: sweep it.
    const sweeping = () => {
      removeTemporaryCopiesOfStoppedServers(missingFolder);
    };

    // Assert: no error; a boot must never fail over a missing /tmp.
    expect(sweeping, 'a missing folder is nothing to sweep').not.toThrow();
  });
});
