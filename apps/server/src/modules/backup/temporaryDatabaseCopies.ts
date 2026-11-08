// The temporary folders the backup copies the database into (BAJAOVRLAY-33), and their
// sweep at boot. A backup removes its own folder when its zip closes; a server killed
// mid-backup never gets there, and its copy (as big as the database) would stay in /tmp.
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// bajaovrlay-copia-<process id>-<six random characters>, as mkdtemp completes it. The id
// says which server made it, so a boot can tell a copy left behind from one another
// server on the same machine (a test run, another checkout's e2e) is still sending.
const copyFolderNamePattern = /^bajaovrlay-copia-(\d+)-/;

/** Makes an empty folder for one backup's database copy, named after this server's process. */
export function makeTemporaryDatabaseCopyFolder(temporaryFolder: string): string {
  return mkdtempSync(join(temporaryFolder, `bajaovrlay-copia-${String(process.pid)}-`));
}

/**
 * Removes the copy folders of servers no longer running, and this process's own: at boot
 * none of this server's backups runs yet, and in Docker a restarted server comes back
 * with the same process id. Anything else in the folder is left alone.
 */
export function removeTemporaryCopiesOfStoppedServers(temporaryFolder: string): void {
  if (!existsSync(temporaryFolder)) {
    return;
  }
  for (const entry of readdirSync(temporaryFolder, { withFileTypes: true })) {
    const match = copyFolderNamePattern.exec(entry.name);
    if (!entry.isDirectory() || match === null) {
      continue;
    }
    const processId = Number(match[1]);
    const isLeftBehind = processId === process.pid || !isProcessRunning(processId);
    if (isLeftBehind) {
      rmSync(join(temporaryFolder, entry.name), { recursive: true, force: true });
    }
  }
}

/**
 * Whether a process with this id runs now. Signal 0 checks without sending anything;
 * EPERM means it runs but belongs to another user. An id reused by an unrelated process
 * reads as running, which only keeps a stale folder until a later boot.
 */
function isProcessRunning(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (signalError) {
    return (signalError as NodeJS.ErrnoException).code === 'EPERM';
  }
}
