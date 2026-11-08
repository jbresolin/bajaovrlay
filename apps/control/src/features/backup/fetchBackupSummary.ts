import { type BackupSummary, BackupSummarySchema } from '@bajaovrlay/shared';

/** The address of the backup zip, on the page's own server (BAJAOVRLAY-33). */
const backupAddress = '/api/v1/backup';

/** What asking for the summary gives: the summary, or that it could not be read. */
export type BackupSummaryOutcome =
  { isFetched: true; summary: BackupSummary } | { isFetched: false };

/**
 * Asks the server for the size of each part of a backup and the newest one made (GET
 * /api/v1/backup/summary). The browser marks this fetch as the page's own (same origin),
 * so it needs no token. Never throws: a server it cannot reach, or an answer it cannot
 * read, gives `isFetched: false`, and the dialog says so.
 */
export async function fetchBackupSummary(): Promise<BackupSummaryOutcome> {
  try {
    const response = await fetch(`${backupAddress}/summary`);
    if (!response.ok) {
      return { isFetched: false };
    }
    const summary = BackupSummarySchema.parse(await response.json());
    return { isFetched: true, summary };
  } catch {
    return { isFetched: false };
  }
}

/**
 * The address "Baixar" links to: the whole data folder, or without the recordings when
 * "Incluir gravações" is unticked. The browser follows it as a download, so the zip goes
 * straight to the file the operator picks, never through the page's memory.
 */
export function buildBackupDownloadAddress(isIncludingRecordings: boolean): string {
  if (isIncludingRecordings) {
    return backupAddress;
  }
  return `${backupAddress}?includeRecordings=false`;
}
