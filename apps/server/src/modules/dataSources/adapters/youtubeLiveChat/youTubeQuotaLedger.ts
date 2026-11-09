// The count of the quota units the server's YouTube key spent today. One ledger for the
// whole server, because Google counts the quota per key (per Google Cloud project), not
// per source: two YouTube sources share the same 10 000 units a day.
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';

import { z } from 'zod';

import type { ServerLogger } from '../../../../core/logger/createLogger.js';
import { readPacificQuotaDay } from './youTubeQuotaDay.js';

/** The name of the ledger's file in DATA_DIR. */
export const youTubeQuotaLedgerFileName = 'youtube-quota.json';

// What the file holds: the quota day the count belongs to, and the count.
const StoredQuotaCountSchema = z.object({
  quotaDay: z.string().min(1),
  unitsSpent: z.number().int().min(0),
});

type StoredQuotaCount = z.infer<typeof StoredQuotaCountSchema>;

/** The running ledger. */
export type YouTubeQuotaLedger = {
  /** The units spent on the quota day of `nowMs`: 0 once a new Pacific day has begun. */
  readUnitsSpentToday: (nowMs: number) => number;
  /** Counts units spent at `nowMs`, and writes the count to the file at once. */
  spendUnits: (units: number, nowMs: number) => void;
};

/** What the ledger needs: its file (none in a test that keeps it in memory) and the logger. */
export type YouTubeQuotaLedgerOptions = {
  /** `<DATA_DIR>/youtube-quota.json`; left out, the count lives in memory only. */
  ledgerFilePath?: string | undefined;
  logger: ServerLogger;
};

/**
 * Opens the ledger, reading the count a previous run left in its file, so a restart in
 * the middle of a race day goes on from the units already spent instead of from zero
 * (which could spend the key's quota twice over). A missing file is a new ledger; a file
 * that cannot be read is logged and taken as zero, the only choice left.
 * Written after every spend, synchronously: the file is a few bytes and a poll spends
 * twice a minute at most. A write that fails is logged and the count kept in memory. The
 * write is atomic (writeStoredCount), so a crash never leaves an empty file behind.
 */
export function openYouTubeQuotaLedger(options: YouTubeQuotaLedgerOptions): YouTubeQuotaLedger {
  const { ledgerFilePath, logger } = options;
  let storedCount: StoredQuotaCount | undefined = readStoredCount(ledgerFilePath, logger);

  /** The stored count when it belongs to the quota day of `nowMs`, else a fresh zero. */
  function readCountOfToday(nowMs: number): StoredQuotaCount {
    const quotaDayNow = readPacificQuotaDay(nowMs);
    if (storedCount === undefined || storedCount.quotaDay !== quotaDayNow) {
      return { quotaDay: quotaDayNow, unitsSpent: 0 };
    }
    return storedCount;
  }

  return {
    readUnitsSpentToday: (nowMs) => readCountOfToday(nowMs).unitsSpent,
    spendUnits: (units, nowMs) => {
      const countOfToday = readCountOfToday(nowMs);
      storedCount = {
        quotaDay: countOfToday.quotaDay,
        unitsSpent: countOfToday.unitsSpent + units,
      };
      writeStoredCount(ledgerFilePath, storedCount, logger);
    },
  };
}

/** The count in the file, or undefined when there is no file or it cannot be read. */
function readStoredCount(
  ledgerFilePath: string | undefined,
  logger: ServerLogger,
): StoredQuotaCount | undefined {
  if (ledgerFilePath === undefined) {
    return undefined;
  }
  let fileText: string;
  try {
    fileText = readFileSync(ledgerFilePath, 'utf8');
  } catch {
    // No file yet: the first YouTube poll of this installation.
    return undefined;
  }
  try {
    return StoredQuotaCountSchema.parse(JSON.parse(fileText));
  } catch (parseError) {
    logger.warn(
      { err: parseError, file: ledgerFilePath },
      'youtube quota ledger unreadable; counting from zero',
    );
    return undefined;
  }
}

/**
 * Writes the count to the file; a failure is logged, never thrown into a poll. Atomic
 * (gate 2 of PR #54): the count goes to `youtube-quota.json.tmp`, is flushed to the disk
 * (fsync), then renamed over the real file, which a rename replaces whole. Written in
 * place, a crash between truncating and writing would leave the file empty, the next boot
 * would count from zero, and the day's budget could be spent twice.
 */
function writeStoredCount(
  ledgerFilePath: string | undefined,
  storedCount: StoredQuotaCount,
  logger: ServerLogger,
): void {
  if (ledgerFilePath === undefined) {
    return;
  }
  const temporaryFilePath = `${ledgerFilePath}.tmp`;
  try {
    const fileDescriptor = openSync(temporaryFilePath, 'w');
    try {
      writeSync(fileDescriptor, JSON.stringify(storedCount));
      fsyncSync(fileDescriptor);
    } finally {
      closeSync(fileDescriptor);
    }
    renameSync(temporaryFilePath, ledgerFilePath);
  } catch (writeError) {
    logger.warn(
      { err: writeError, file: ledgerFilePath },
      'youtube quota ledger not written; the count stays in memory',
    );
  }
}
