/**
 * A backup downloaded from the header holds what was made before it (apps/control, Playwright)
 *
 * What this module is for:
 *   At a session break the operator opens "Cópia de segurança", clicks "Baixar", and the
 *   browser saves one zip onto the USB stick (BAJAOVRLAY-33). That zip is what brings the
 *   show back on another machine, so this test walks the operator's path in a real
 *   Chromium against the real server and a real SQLite file, then unzips what the browser
 *   saved and reads the database inside.
 *
 * What these tests prove:
 *   - An item made on the page before the backup ("Relógio da largada" on "Atalhos") is in
 *     the database of the zip the browser saved, under the name the server gives it, and
 *     SQLite calls that database whole; leia-me.txt is beside it.
 *   - Once the zip is saved, the dialog shows "Última cópia" with its size, read from the
 *     event log row the server wrote.
 *
 * What these tests deliberately do not cover:
 *   - Recordings left out, a second backup refused, a copy made while the server writes:
 *     the server's backupDownloadRoute.test.ts.
 *   - The sizes and the last-copy line in every case: BackupDialog.test.tsx.
 *   - Restoring: by hand, as deploy/stream-pc/README.md says.
 *
 * What it needs: the race clock built (`pnpm build`), because the server only registers
 * built graphics.
 */
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
  readEveryFileOfZip,
  readTheDatabaseOfTheBackup,
} from '../../server/src/modules/backup/backupZipReading.testSupport.js';
import { emptyTheServerState } from './emptyTheServerState';
import { openControlPageAndWaitUntilConnected } from './previewTestSteps';
import { createRaceClockButtonInPanelShown } from './quickFireTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('"Cópia de segurança"', () => {
  test('saves a zip holding the item made before it, and shows the last copy', async ({
    page,
  }, testInfo) => {
    // Arrange: the operator has made the start clock on "Atalhos".
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockButtonInPanelShown(page, 'Relógio da largada', 'Enduro — Largada');

    // Act: open "Cópia de segurança" from the header's menu, wait for the size, click
    // "Baixar" and let the browser save the file; then unzip it.
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Cópia de segurança' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cópia de segurança' });
    await expect(
      dialog.getByText(/^Tamanho previsto: /),
      'the size must be read first',
    ).toBeVisible();
    const downloadStarting = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Baixar' }).click();
    const download = await downloadStarting;
    const savedZipPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(savedZipPath);
    const filesInTheZip = await readEveryFileOfZip(readFileSync(savedZipPath));
    const database = readTheDatabaseOfTheBackup(
      filesInTheZip.get('bajaovrlay.sqlite') ?? Buffer.alloc(0),
    );

    // Assert: named as the server names it; leia-me.txt beside a whole database holding
    // the item; and the dialog shows the copy just made.
    expect(download.suggestedFilename(), 'saved as bajaovrlay-AAAA-MM-DD-HHMM.zip').toMatch(
      /^bajaovrlay-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/,
    );
    expect(filesInTheZip.has('leia-me.txt'), 'leia-me.txt says what the zip holds').toBe(true);
    expect(database.integrity, 'SQLite must call the copy whole').toBe('ok');
    expect(database.itemLabels, 'the item made before the backup is in it').toContain(
      'Relógio da largada',
    );
    await expect(
      dialog.getByText(/^Última cópia: \d{2}:\d{2}, /),
      'the copy just made shows as the last one',
    ).toBeVisible();
  });
});
