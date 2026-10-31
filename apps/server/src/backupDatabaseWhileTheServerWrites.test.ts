/**
 * The backup command while the server is running (apps/server)
 *
 * What this module is for:
 *   `node apps/server/dist/backupDatabase.js /data/backups` is run by João's nightly
 *   script with `docker exec`, so it always runs next to a server that may be writing at
 *   that moment (a data source polling, an operator taking an item). It must still write
 *   a copy SQLite calls whole. This drives the command as a process of its own, as
 *   docker exec does, against a booted server writing as fast as it can.
 *
 * What these tests prove (with a real server, a real SQLite file and a real process):
 *   - The command exits 0 and writes one dated copy while the server keeps writing.
 *   - The server kept writing while the command ran (otherwise this would prove nothing).
 *   - The copy opens and passes PRAGMA integrity_check, and holds every panel the server
 *     had made before the backup began.
 *   - The command logs one JSON line naming the copy.
 *
 * What these tests deliberately do not cover:
 *   - Naming and keeping 14: core/db/databaseBackup.test.ts.
 *   - The built file and the image: scripts/dockerSmoke.sh runs it inside the container.
 */
import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setImmediate as waitForTheNextTurn } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import Database from 'better-sqlite3';
import { describe, expect, it, onTestFinished } from 'vitest';

import { buildBootOptions, operatorActor } from './core/boot/bootedServer.testSupport.js';
import { startServer } from './core/boot/startServer.js';
import { createTemporaryDataFolder } from './core/boot/temporaryDataFolder.testSupport.js';
import { committedMigrationsFolder } from './core/db/openDatabase.js';
import type { StateStore } from './core/store/createStateStore.js';

const runProcess = promisify(execFile);

/** apps/server: the command runs from here, as `pnpm --filter @bajaovrlay/server` would. */
const serverPackageFolder = fileURLToPath(new URL('..', import.meta.url));

// The panels the server makes before the backup: enough for the copy to have something
// to check, few enough to stay fast.
const panelsMadeBeforeTheBackup = 200;

/**
 * Runs the backup command from its TypeScript source, as its own process (tsx compiles it
 * on the way, as `pnpm dev` does for main.ts), on the given database. Resolves with what
 * it printed once it exits 0; rejects with its output otherwise.
 */
async function runTheBackupCommand(databasePath: string, backupFolder: string) {
  return await runProcess(
    process.execPath,
    ['--import', 'tsx', '--conditions=@bajaovrlay/source', 'src/backupDatabase.ts', backupFolder],
    {
      cwd: serverPackageFolder,
      env: { ...process.env, DATABASE_PATH: databasePath, LOG_LEVEL: 'info' },
    },
  );
}

/** Makes one quick-fire panel, a command that writes the database as any other does. */
function makeOnePanel(stateStore: StateStore, panelNumber: number): void {
  const outcome = stateStore.applyCommand(
    { type: 'createQuickFirePanel', name: `Bateria ${String(panelNumber)}` },
    operatorActor,
  );
  if (!outcome.ok) {
    throw new Error(`the server refused panel ${String(panelNumber)}`);
  }
}

/** Opens a backup on its own and answers what PRAGMA integrity_check says and its panels. */
function checkTheBackupFile(backupPath: string): { integrity: string; panelNames: string[] } {
  const backup = new Database(backupPath, { readonly: true });
  onTestFinished(() => {
    backup.close();
  });
  const integrityRow = backup.prepare('PRAGMA integrity_check').get() as {
    integrity_check: string;
  };
  const panelsRow = backup
    .prepare("SELECT json FROM slices WHERE name = 'quickFirePanels'")
    .get() as { json: string } | undefined;
  const panels = panelsRow === undefined ? [] : (JSON.parse(panelsRow.json) as { name: string }[]);
  return {
    integrity: integrityRow.integrity_check,
    panelNames: panels.map((panel) => panel.name),
  };
}

describe('backupDatabase.js while the server writes', () => {
  // 30 s: a cold tsx start of the command alone has taken 3 s on this machine.
  it('writes a whole copy while the server keeps writing', { timeout: 30_000 }, async () => {
    // Arrange: a booted server that has made 200 panels, and an empty backup folder.
    const bootOptions = buildBootOptions(committedMigrationsFolder);
    const runningServer = await startServer(bootOptions);
    onTestFinished(() => runningServer.close());
    for (let panelNumber = 1; panelNumber <= panelsMadeBeforeTheBackup; panelNumber += 1) {
      makeOnePanel(runningServer.stateStore, panelNumber);
    }
    const backupFolder = join(createTemporaryDataFolder(), 'backups');

    // Act: run the command, and keep the server making panels until it exits.
    let isTheBackupRunning = true;
    const backingUp = runTheBackupCommand(bootOptions.databasePath, backupFolder);
    // Only marks the end, success or failure; the outcome itself is awaited after the loop.
    backingUp
      .finally(() => {
        isTheBackupRunning = false;
      })
      .catch(() => undefined);
    let panelsMadeDuringTheBackup = 0;
    while (isTheBackupRunning) {
      panelsMadeDuringTheBackup += 1;
      makeOnePanel(runningServer.stateStore, panelsMadeBeforeTheBackup + panelsMadeDuringTheBackup);
      await waitForTheNextTurn();
    }
    const { stdout } = await backingUp;

    // Assert: the server wrote while the backup ran, and the one copy is whole and holds
    // every panel made before it began.
    // One write per turn of the event loop for as long as the process ran: 36 to 564 in
    // the runs measured, so ten or fewer means the command ran with the server idle.
    expect(
      panelsMadeDuringTheBackup,
      'the server must have kept writing while the command ran',
    ).toBeGreaterThan(10);
    const backupNames = readdirSync(backupFolder);
    expect(backupNames, 'one dated copy').toHaveLength(1);
    expect(backupNames[0], 'named bajaovrlay-<date>T<time>Z.sqlite').toMatch(
      /^bajaovrlay-\d{4}-\d{2}-\d{2}T\d{6}Z\.sqlite$/,
    );
    const backupPath = join(backupFolder, backupNames[0] ?? '');
    const { integrity, panelNames } = checkTheBackupFile(backupPath);
    expect(integrity, 'SQLite must call the copy whole').toBe('ok');
    expect(panelNames, 'the copy must hold the last panel made before the backup').toContain(
      `Bateria ${String(panelsMadeBeforeTheBackup)}`,
    );
    expect(stdout, 'the command logs the copy it wrote').toContain(backupPath);
  });
});
