/**
 * The backup download over HTTP (apps/server)
 *
 * What this module is for:
 *   At every session break the operator clicks "Baixar" in "Cópia de segurança" and the
 *   browser saves GET /api/v1/backup onto a USB stick (BAJAOVRLAY-33). On the stream PC the
 *   server runs in Docker, which cannot see the stick, so the backup is a download. The
 *   zip must open on any machine and bring the show back: the database, the uploaded
 *   images, the recordings unless left out, and a leia-me.txt saying what is inside.
 *
 * What these tests prove (a booted server, a real SQLite file, real HTTP, the zip unzipped):
 *   - The zip holds bajaovrlay.sqlite, media/ and recordings/ as they are on disk, and a
 *     leia-me.txt naming the version and its contents; the database passes PRAGMA
 *     integrity_check and holds the panel made before the backup.
 *   - With includeRecordings=false, recordings/ stays out and leia-me.txt says so.
 *   - A backup made while the server keeps writing still opens whole, with every panel
 *     made before it began.
 *   - A second request while the first is still being sent is refused (409) in pt-BR,
 *     and meanwhile the summary says a backup is running.
 *   - A finished backup writes one event-log row with the zip's size (as handed to the
 *     socket; this client received all of it), and the summary route then answers it as
 *     the newest backup, with the size of each part.
 *   - A query it cannot read gets 400.
 *   - A client that hangs up 5 ms in, while the database is still being copied, leaves no
 *     backup running and no temporary copy. Before gate 2 the server never noticed (the
 *     answer was not sent yet), so every later backup got 409 until a restart.
 *   - A boot removes the temporary copy a server killed mid-backup left behind.
 *
 * What these tests deliberately do not cover:
 *   - That the zip is streamed with bounded memory: backupZipStreaming.test.ts.
 *   - A download cancelled while being sent, a stalled reader, and the temporary copy:
 *     backupDownloads.test.ts.
 *   - Which leftover copies a boot removes: temporaryDatabaseCopies.test.ts.
 *   - Who may call the routes with the login on (a session, Produtor or Dados):
 *     api/v1/operatorRouteAccess.test.ts. These tests run with the login off.
 *   - The browser saving the file: the control page's backupDownload.e2e.ts.
 */
import { existsSync, mkdirSync, readdirSync, truncateSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { setImmediate as waitForTheNextTurn, setTimeout as waitFor } from 'node:timers/promises';

import Database from 'better-sqlite3';
import { describe, expect, it, onTestFinished } from 'vitest';

import { buildBootOptions, operatorActor } from '../../core/boot/bootedServer.testSupport.js';
import { startServer } from '../../core/boot/startServer.js';
import { committedMigrationsFolder } from '../../core/db/openDatabase.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { readEveryFileOfZip, readTheDatabaseOfTheBackup } from './backupZipReading.testSupport.js';

/**
 * What the control page's own fetch and link carry: the browser marks them same-origin.
 * The access no longer reads it (a session decides, BAJAOVRLAY-29); the requests are sent
 * as the page sends them.
 */
const headersOfTheControlPage = { 'sec-fetch-site': 'same-origin' };

/** The recorded enduro feed's file, as the recorder names it under recordings/<sourceId>/. */
const recordingPathInTheZip = 'recordings/simulador-enduro/2026-11-14T13-00-00Z.jsonl';
const recordingLine = '{"atMs":1794661200000,"snapshotNumber":1,"data":{"leader":42}}\n';

/** Makes one quick-fire panel, a command that writes the database as any other does. */
function makeOnePanel(stateStore: StateStore, panelName: string): void {
  const outcome = stateStore.applyCommand(
    { type: 'createQuickFirePanel', name: panelName },
    operatorActor,
  );
  if (!outcome.ok) {
    throw new Error(`the server refused the panel "${panelName}"`);
  }
}

/**
 * A booted server with a panel "Bateria 1", team 42's logo in its media and one recording
 * of the enduro feed, and the address of its API.
 */
async function startServerWithDataToBackUp() {
  const bootOptions = buildBootOptions(committedMigrationsFolder);
  const runningServer = await startServer(bootOptions);
  onTestFinished(() => runningServer.close());
  makeOnePanel(runningServer.stateStore, 'Bateria 1');
  writeFileSync(join(bootOptions.dataFolder, 'media', 'logo-baja-ufpr.png'), 'logo da equipe 42');
  const recordingFolder = join(bootOptions.dataFolder, 'recordings', 'simulador-enduro');
  mkdirSync(recordingFolder, { recursive: true });
  writeFileSync(join(recordingFolder, '2026-11-14T13-00-00Z.jsonl'), recordingLine);
  const apiAddress = `http://127.0.0.1:${String(runningServer.port)}/api/v1`;
  return { runningServer, bootOptions, apiAddress };
}

/** Downloads a backup as the control page does, and answers the response and its bytes. */
async function downloadBackup(apiAddress: string, query = '') {
  const response = await fetch(`${apiAddress}/backup${query}`, {
    headers: headersOfTheControlPage,
  });
  const zipBytes = Buffer.from(await response.arrayBuffer());
  return { response, zipBytes };
}

/** Resolves once the store has logged a recordBackup: the server records it at the zip's close. */
async function waitForTheBackupRow(stateStore: StateStore): Promise<void> {
  while (stateStore.readAllSlices().eventLog.at(-1)?.command !== 'recordBackup') {
    await waitForTheNextTurn();
  }
}

/**
 * Sends GET /api/v1/backup as the control page's link does, and hangs up `hangUpAfterMs`
 * later, before any answer can come: the operator closing the tab right after "Baixar".
 * Resolves once the connection is closed.
 */
async function askForABackupAndHangUp(apiAddress: string, hangUpAfterMs: number): Promise<void> {
  const backupRequest = request(`${apiAddress}/backup`, { headers: headersOfTheControlPage });
  // The hang-up itself ends the request with an error ("socket hang up"); that is what
  // this simulates, so the error is expected and only the close is waited for.
  backupRequest.on('error', () => undefined);
  const closing = new Promise((resolve) => backupRequest.once('close', resolve));
  backupRequest.end();
  await waitFor(hangUpAfterMs);
  backupRequest.destroy();
  await closing;
}

/**
 * Asks for the summary until it says no backup runs, for up to 3 s, and answers whether it
 * ever did: the server notices a hang-up on its own time.
 */
async function waitUntilNoBackupRuns(apiAddress: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 150; attempt += 1) {
    const summaryResponse = await fetch(`${apiAddress}/backup/summary`, {
      headers: headersOfTheControlPage,
    });
    const summary = (await summaryResponse.json()) as { isABackupRunning: boolean };
    if (!summary.isABackupRunning) {
      return true;
    }
    await waitFor(20);
  }
  return false;
}

describe('GET /api/v1/backup', () => {
  it('sends a zip with the database, the media, the recordings and a leia-me', async () => {
    // Arrange: a server with a panel, a logo and a recording.
    const { apiAddress } = await startServerWithDataToBackUp();

    // Act: download the backup and unzip it.
    const { response, zipBytes } = await downloadBackup(apiAddress);
    const filesInTheZip = await readEveryFileOfZip(zipBytes);

    // Assert: a named zip attachment holding the four parts; the database whole, with the
    // panel; the media and recording as on disk; leia-me naming the version and contents.
    expect(response.status, 'the backup is sent').toBe(200);
    expect(response.headers.get('content-type'), 'a zip').toBe('application/zip');
    expect(
      response.headers.get('content-disposition'),
      'saved under bajaovrlay-AAAA-MM-DD-HHMM.zip',
    ).toMatch(/^attachment; filename="bajaovrlay-\d{4}-\d{2}-\d{2}-\d{4}\.zip"$/);
    expect(
      [...filesInTheZip.keys()],
      'the database, the leia-me, the logo and the recording',
    ).toEqual([
      'bajaovrlay.sqlite',
      'leia-me.txt',
      'media/logo-baja-ufpr.png',
      recordingPathInTheZip,
    ]);
    const database = readTheDatabaseOfTheBackup(
      filesInTheZip.get('bajaovrlay.sqlite') ?? Buffer.alloc(0),
    );
    expect(database.integrity, 'SQLite must call the copy whole').toBe('ok');
    expect(database.quickFirePanelNames, 'the copy holds the panel made before it').toContain(
      'Bateria 1',
    );
    expect(filesInTheZip.get('media/logo-baja-ufpr.png')?.toString(), 'the logo as on disk').toBe(
      'logo da equipe 42',
    );
    expect(filesInTheZip.get(recordingPathInTheZip)?.toString(), 'the recording as on disk').toBe(
      recordingLine,
    );
    const readMe = filesInTheZip.get('leia-me.txt')?.toString() ?? '';
    expect(readMe, 'leia-me names the version').toContain('Versão do BajaOvrLay: 0.3.1');
    expect(readMe, 'leia-me counts the images').toContain('as imagens enviadas (1 arquivo)');
    expect(readMe, 'leia-me counts the recordings').toContain(
      'as gravações das fontes de dados (1 arquivo)',
    );
  });

  it('leaves the recordings out when "Incluir gravações" is unticked', async () => {
    // Arrange: a server with a panel, a logo and a recording.
    const { apiAddress } = await startServerWithDataToBackUp();

    // Act: download the backup without recordings and unzip it.
    const { zipBytes } = await downloadBackup(apiAddress, '?includeRecordings=false');
    const filesInTheZip = await readEveryFileOfZip(zipBytes);

    // Assert: no recordings/ in it, and leia-me says why.
    expect([...filesInTheZip.keys()], 'everything but the recording').toEqual([
      'bajaovrlay.sqlite',
      'leia-me.txt',
      'media/logo-baja-ufpr.png',
    ]);
    expect(
      filesInTheZip.get('leia-me.txt')?.toString(),
      'leia-me says they were left out',
    ).toContain('Sem gravações: "Incluir gravações" estava desmarcado.');
  });

  it('sends a whole database while the server keeps writing', { timeout: 30_000 }, async () => {
    // Arrange: a server that has made 200 panels.
    const { runningServer, apiAddress } = await startServerWithDataToBackUp();
    for (let panelNumber = 2; panelNumber <= 200; panelNumber += 1) {
      makeOnePanel(runningServer.stateStore, `Bateria ${String(panelNumber)}`);
    }

    // Act: download the backup, and keep making panels until the download is done.
    let isTheDownloadRunning = true;
    const downloading = downloadBackup(apiAddress);
    // Only marks the end, success or failure; the outcome itself is awaited after the loop.
    downloading
      .finally(() => {
        isTheDownloadRunning = false;
      })
      .catch(() => undefined);
    let panelsMadeDuringTheDownload = 0;
    while (isTheDownloadRunning) {
      panelsMadeDuringTheDownload += 1;
      makeOnePanel(
        runningServer.stateStore,
        `Bateria ${String(200 + panelsMadeDuringTheDownload)}`,
      );
      await waitForTheNextTurn();
    }
    const { zipBytes } = await downloading;
    const filesInTheZip = await readEveryFileOfZip(zipBytes);

    // Assert: the server wrote during the download, and the copy is whole with panel 200.
    expect(
      panelsMadeDuringTheDownload,
      'the server must have kept writing while the backup was made',
    ).toBeGreaterThan(1);
    const database = readTheDatabaseOfTheBackup(
      filesInTheZip.get('bajaovrlay.sqlite') ?? Buffer.alloc(0),
    );
    expect(database.integrity, 'SQLite must call the copy whole').toBe('ok');
    expect(database.quickFirePanelNames, 'the copy holds the last panel made before it').toContain(
      'Bateria 200',
    );
  });

  it('refuses a second backup while the first is still being sent', async () => {
    // Arrange: a server whose media holds a 64 MB video, more than the connection buffers,
    // and a first download whose body is not read, so it stays running.
    const { bootOptions, apiAddress } = await startServerWithDataToBackUp();
    const videoPath = join(bootOptions.dataFolder, 'media', 'abertura.mp4');
    writeFileSync(videoPath, '');
    truncateSync(videoPath, 64 * 1024 * 1024);
    const firstResponse = await fetch(`${apiAddress}/backup`, { headers: headersOfTheControlPage });
    onTestFinished(() => firstResponse.body?.cancel());

    // Act: ask for the summary, then for a second backup.
    const summaryResponse = await fetch(`${apiAddress}/backup/summary`, {
      headers: headersOfTheControlPage,
    });
    const secondResponse = await fetch(`${apiAddress}/backup`, {
      headers: headersOfTheControlPage,
    });

    // Assert: the first is being sent, and the summary says so; the second is refused
    // with the reason in pt-BR.
    expect(firstResponse.status, 'the first backup is being sent').toBe(200);
    expect(await summaryResponse.json(), 'the dialog learns a backup is running').toMatchObject({
      isABackupRunning: true,
    });
    expect(secondResponse.status, 'one backup at a time').toBe(409);
    expect(await secondResponse.json(), 'the operator reads why').toEqual({
      error: {
        code: 'BACKUP_ALREADY_RUNNING',
        message: 'Já há uma cópia de segurança sendo baixada. Espere ela terminar e tente de novo.',
      },
    });
  });

  it('records the finished backup with its size, and the summary answers it', async () => {
    // Arrange: a server with a panel, a logo and a recording.
    const { runningServer, apiAddress } = await startServerWithDataToBackUp();

    // Act: download a backup, wait for its row, and ask for the summary.
    const { zipBytes } = await downloadBackup(apiAddress);
    await waitForTheBackupRow(runningServer.stateStore);
    const summaryResponse = await fetch(`${apiAddress}/backup/summary`, {
      headers: headersOfTheControlPage,
    });

    // Assert: one row signed sistema:backup with the size this client received; the
    // summary answers that backup and the sizes of the logo and the recording.
    const backupRow = runningServer.stateStore.readAllSlices().eventLog.at(-1);
    expect(backupRow, 'the finished backup is in the event log').toMatchObject({
      actor: 'sistema:backup',
      command: 'recordBackup',
      payload: { sizeInBytes: zipBytes.length, includesRecordings: true },
    });
    const summary: unknown = await summaryResponse.json();
    expect(summary, 'the sizes on disk and the backup just made').toMatchObject({
      mediaSizeInBytes: 'logo da equipe 42'.length,
      recordingsSizeInBytes: recordingLine.length,
      latestBackup: { madeAt: backupRow?.ts, sizeInBytes: zipBytes.length },
      isABackupRunning: false,
    });
  });

  const refusedRequests: Array<{
    name: string;
    address: string;
    headers: Record<string, string>;
    expectedStatus: number;
  }> = [
    // A typo in the query must not silently include or leave out the recordings.
    {
      name: 'an includeRecordings that is not true or false gets 400',
      address: '/backup?includeRecordings=talvez',
      headers: headersOfTheControlPage,
      expectedStatus: 400,
    },
  ];

  it.each(refusedRequests)('$name', async ({ address, headers, expectedStatus }) => {
    // Arrange: a server with data to back up.
    const { apiAddress } = await startServerWithDataToBackUp();

    // Act: send the request of this row.
    const response = await fetch(`${apiAddress}${address}`, { headers });

    // Assert: refused with the status of this row.
    expect(response.status, `${address} must be refused`).toBe(expectedStatus);
  });

  it('leaves no backup running and no copy when the client hangs up 5 ms in', async () => {
    // Arrange: a server whose media holds a 64 MB video, more than the connection buffers
    // (a small zip would fit in them whole and count as sent), and whose database another
    // connection holds locked for a moment (a write being committed), so the copy is
    // still waiting when the client leaves.
    const { bootOptions, apiAddress } = await startServerWithDataToBackUp();
    const videoPath = join(bootOptions.dataFolder, 'media', 'abertura.mp4');
    writeFileSync(videoPath, '');
    truncateSync(videoPath, 64 * 1024 * 1024);
    const lockingConnection = new Database(bootOptions.databasePath);
    onTestFinished(() => {
      lockingConnection.close();
    });
    lockingConnection.exec('BEGIN EXCLUSIVE');

    // Act: ask for a backup and hang up 5 ms in; then release the lock, so the copy
    // finishes with nobody to send it to.
    await askForABackupAndHangUp(apiAddress, 5);
    lockingConnection.exec('ROLLBACK');
    const isNoLongerRunning = await waitUntilNoBackupRuns(apiAddress);

    // Assert: no backup left running, so the next one may start, and no copy left behind.
    expect(isNoLongerRunning, 'a backup nobody waits for must not block the next').toBe(true);
    expect(
      readdirSync(bootOptions.backupTemporaryFolder),
      'its temporary copy of the database must be gone',
    ).toEqual([]);
  });

  it('removes at boot the temporary copy a server killed mid-backup left behind', async () => {
    // Arrange: the copy a server of this process id left before a restart, 200 MB on the
    // stream PC, in the temporary folder the backups use.
    const bootOptions = buildBootOptions(committedMigrationsFolder);
    const leftoverCopyFolder = join(
      bootOptions.backupTemporaryFolder,
      `bajaovrlay-copia-${String(process.pid)}-Rq7Lmz`,
    );
    mkdirSync(leftoverCopyFolder);
    writeFileSync(join(leftoverCopyFolder, 'bajaovrlay.sqlite'), 'cópia que ficou para trás');

    // Act: boot the server.
    const runningServer = await startServer(bootOptions);
    onTestFinished(() => runningServer.close());

    // Assert: the leftover copy is gone.
    expect(existsSync(leftoverCopyFolder), 'a boot must clear the copies left behind').toBe(false);
  });
});
