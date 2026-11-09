/**
 * "Cópia de segurança": the size of a backup and the last copy made (apps/control)
 *
 * What this module is for:
 *   At every session break the operator opens "Cópia de segurança" from the header's menu,
 *   leaves "Incluir gravações" ticked or not, checks the expected size against the USB
 *   stick, and clicks "Baixar"; the browser saves the zip (BAJAOVRLAY-33). The dialog then
 *   says "Última cópia: 14:32, 48 MB", read from the event log, so the operator sees when
 *   the last copy was made before leaving the break.
 *
 * What these tests prove (a fake server, and GET /api/v1/backup/summary answered by hand):
 *   - The expected size is the database plus the media plus the recordings, and unticking
 *     "Incluir gravações" takes the recordings off it and out of the "Baixar" address.
 *   - "Última cópia" shows the copy the server answered, with its time and size; a copy
 *     made since, arriving in the live event log, takes its place at once; a copy of
 *     another day shows its date too; with none, it says so.
 *   - While another backup is being sent there is no "Baixar", only the reason.
 *   - A server that does not answer is said in pt-BR, with no size made up.
 *
 * What these tests deliberately do not cover:
 *   - The zip and the route: the server's backupDownloadRoute.test.ts.
 *   - The browser saving the file: backupDownload.e2e.ts.
 */
import type { BackupSummary, EventLogEntry } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HeaderMenu } from '@/features/headerMenu/HeaderMenu';
import { formatDateAndTimeOfDay } from '@/i18n/timeOfDayText';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

const oneMegabyte = 1024 * 1024;

/** Today at the given hour and minute on the operator's clock, as the server writes it. */
function buildTodayAt(hour: number, minute: number): string {
  const moment = new Date();
  moment.setHours(hour, minute, 0, 0);
  return moment.toISOString();
}

/**
 * What the server answers mid-event: a 2 MB database, 10 MB of logos and 36 MB of
 * recordings, and the 14:32 copy of 48 MB as the newest backup.
 */
function buildSummaryOfARaceDay(overrides: Partial<BackupSummary> = {}): BackupSummary {
  return {
    databaseSizeInBytes: 2 * oneMegabyte,
    mediaSizeInBytes: 10 * oneMegabyte,
    recordingsSizeInBytes: 36 * oneMegabyte,
    latestBackup: { madeAt: buildTodayAt(14, 32), sizeInBytes: 48 * oneMegabyte },
    isABackupRunning: false,
    ...overrides,
  };
}

/** Answers GET /api/v1/backup/summary with `summary`, as the server would. */
function answerTheSummaryWith(summary: BackupSummary): void {
  const answerTheSummary = vi.fn(() => Promise.resolve(Response.json(summary)));
  vi.stubGlobal('fetch', answerTheSummary);
}

/** Draws the header's menu on a connected page, and opens the dialog from it. */
function openTheBackupDialog() {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <HeaderMenu />,
    buildSlicesWithNothingOnAir(),
  );
  // Radix opens its menu on a pointer press or on Enter; Enter needs no pointer stand-in.
  fireEvent.keyDown(screen.getByRole('button', { name: 'Menu' }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cópia de segurança' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Cópia de segurança' }));
  return { controlPage, dialog };
}

/** The row a finished backup of 50 MB at 16:05 today writes, as the server sends it live. */
function buildBackupRowAt1605(): EventLogEntry {
  return {
    id: 812,
    ts: buildTodayAt(16, 5),
    actor: 'sistema:backup',
    command: 'recordBackup',
    payload: {
      type: 'recordBackup',
      fileName: 'bajaovrlay-2026-11-14-1605.zip',
      sizeInBytes: 50 * oneMegabyte,
      includesRecordings: true,
    },
    result: { status: 'ok' },
  };
}

describe('the "Cópia de segurança" dialog', () => {
  it('adds up the expected size, and takes the recordings off when unticked', async () => {
    // Arrange: the server's summary of a race day.
    answerTheSummaryWith(buildSummaryOfARaceDay());

    // Act: open the dialog, read the size, then untick "Incluir gravações".
    const { dialog } = openTheBackupDialog();
    const sizeWithRecordings = await dialog.findByText('Tamanho previsto: 48 MB');
    const downloadLinkWithRecordings = dialog
      .getByRole('link', { name: 'Baixar' })
      .getAttribute('href');
    fireEvent.click(dialog.getByRole('checkbox', { name: 'Incluir gravações' }));

    // Assert: 2 + 10 + 36 = 48 MB with the recordings, 12 MB without, and "Baixar" asks
    // for them only while ticked.
    expect(sizeWithRecordings, 'database, media and recordings').toBeTruthy();
    expect(downloadLinkWithRecordings, 'ticked: the whole data folder').toBe('/api/v1/backup');
    expect(dialog.getByText('Tamanho previsto: 12 MB'), 'database and media only').toBeTruthy();
    expect(
      dialog.getByRole('link', { name: 'Baixar' }).getAttribute('href'),
      'unticked: the recordings are left out',
    ).toBe('/api/v1/backup?includeRecordings=false');
  });

  it('shows the last copy the server answered, then one made since as it arrives', async () => {
    // Arrange: the server's newest backup is the 14:32 copy of 48 MB.
    answerTheSummaryWith(buildSummaryOfARaceDay());
    const { controlPage, dialog } = openTheBackupDialog();
    const lineBefore = await dialog.findByText('Última cópia: 14:32, 48 MB');

    // Act: a backup of 50 MB finishes at 16:05, and its row arrives in the live event log.
    controlPage.fakeServer.sendMessage({
      type: 'slice',
      name: 'eventLog',
      slice: [buildBackupRowAt1605()],
    });

    // Assert: first the 14:32 copy, then the 16:05 one in its place.
    expect(lineBefore, 'the copy read from the database').toBeTruthy();
    expect(
      await dialog.findByText('Última cópia: 16:05, 50 MB'),
      'the copy just made shows at once',
    ).toBeTruthy();
  });

  it('writes the date of a last copy made on another day', async () => {
    // Arrange: the newest backup was made yesterday at the morning break.
    const yesterdayAt1030 = new Date();
    yesterdayAt1030.setDate(yesterdayAt1030.getDate() - 1);
    yesterdayAt1030.setHours(10, 30, 0, 0);
    answerTheSummaryWith(
      buildSummaryOfARaceDay({
        latestBackup: { madeAt: yesterdayAt1030.toISOString(), sizeInBytes: 48 * oneMegabyte },
      }),
    );

    // Act: open the dialog.
    const { dialog } = openTheBackupDialog();

    // Assert: the line names yesterday's date with the time.
    const expectedWhen = formatDateAndTimeOfDay(yesterdayAt1030.getTime());
    expect(
      await dialog.findByText(`Última cópia: ${expectedWhen}, 48 MB`),
      'a copy of another day must not read as today’s',
    ).toBeTruthy();
  });

  it('says no copy was made yet on a new server', async () => {
    // Arrange: no backup in the event log.
    answerTheSummaryWith(buildSummaryOfARaceDay({ latestBackup: null }));

    // Act: open the dialog.
    const { dialog } = openTheBackupDialog();

    // Assert: it says so.
    expect(await dialog.findByText('Nenhuma cópia feita ainda.'), 'no copy yet').toBeTruthy();
  });

  it('offers no "Baixar" while another backup is being sent, and says why', async () => {
    // Arrange: a backup is being sent from another tab.
    answerTheSummaryWith(buildSummaryOfARaceDay({ isABackupRunning: true }));

    // Act: open the dialog.
    const { dialog } = openTheBackupDialog();

    // Assert: the reason, and no "Baixar" the server would refuse.
    expect(
      await dialog.findByText(
        'Já há uma cópia de segurança sendo baixada. Espere ela terminar e abra esta janela de novo.',
      ),
      'the operator reads why',
    ).toBeTruthy();
    expect(dialog.queryByRole('link', { name: 'Baixar' }), 'no download to refuse').toBeNull();
  });

  it('says the server could not be reached, with no size made up', async () => {
    // Arrange: the server does not answer.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    // Act: open the dialog.
    const { dialog } = openTheBackupDialog();

    // Assert: the pt-BR sentence, and no expected size.
    expect(
      await dialog.findByText(
        'Não consegui falar com o servidor para calcular o tamanho. Tente de novo.',
      ),
      'the operator reads that the server did not answer',
    ).toBeTruthy();
    expect(dialog.queryByText(/Tamanho previsto/), 'no size made up').toBeNull();
  });
});
