import type { DataSource, DataSourceStatus } from '@bajaovrlay/shared';

import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';

/**
 * How a source is doing, in one word, as the page shows it:
 * - `off`: the source is turned off ("Desligada");
 * - `error`: it is failing and either never had good data, or has been failing for a
 *   minute or more ("Erro", red); its last data, if any, stays shown;
 * - `stale`: its data is late — failing for under a minute, or marked late by the server
 *   with no error yet, as every source that is on is right after a restart — and the
 *   last good data is still there and shown ("Atrasada", amber);
 * - `ok`: on and fresh ("Ok").
 */
export type DataSourceHealth = 'ok' | 'stale' | 'error' | 'off';

// João's ruling 4 at gate 2 of PR #16: amber "Atrasada" says "keep an eye on it"; after
// a minute of failing, the operator must act (or take the data off air), so it is red.
// Counted from the server's `failingSinceMs` (his re-check), not from `lastOkAtMs`: the
// server does not rewrite lastOkAtMs on a poll that repeats the stored data (D7), so a
// source whose data stood still for minutes would otherwise read red at its first failure.
const failingTimeBeforeAStaleSourceIsInErrorMs = 60_000;

/**
 * Sums a source's status up at `nowMs`, a moment on the server's clock (as the status's
 * moments are). The server owns staleness and when the failing started: `status.isStale`
 * and `status.failingSinceMs` are as the server sent them. The page adds only the minute
 * rule: a late source with an error reads "Erro" at once if it never had good data, or
 * once a minute has passed since it started failing. A late source with no error yet
 * (after a restart, or just turned on again) is waiting for a poll, not failing, so it
 * reads "Atrasada" with no reason rather than a red "Erro" with none; the poller gives it
 * a reason, and the server a failingSinceMs, if that poll does not come.
 */
export function findHealthOfDataSource(source: DataSource, nowMs: number): DataSourceHealth {
  if (!source.isEnabled) {
    return 'off';
  }
  if (!source.status.isStale) {
    return 'ok';
  }
  const hasAnErrorToShow = source.status.lastError !== null;
  if (!hasAnErrorToShow) {
    return 'stale';
  }
  const hasNeverHadGoodData = source.status.lastOkAtMs === undefined;
  if (hasNeverHadGoodData) {
    return 'error';
  }
  const failingSinceMs = source.status.failingSinceMs;
  if (failingSinceMs === undefined) {
    // An error with no failingSinceMs comes only from a database written before the field
    // existed; the next failed poll sets it, so amber until then. What could go wrong: an
    // adapter that hangs instead of failing never brings that poll (the poller's stale
    // watch skips a source already stale with a reason), so it stays amber.
    return 'stale';
  }
  const millisecondsSpentFailing = nowMs - failingSinceMs;
  if (millisecondsSpentFailing >= failingTimeBeforeAStaleSourceIsInErrorMs) {
    return 'error';
  }
  return 'stale';
}

/**
 * The moment the amber "Atrasada (há N)" counts from: when the source started failing,
 * or, when it is late without failing (right after a restart), its last good data, the
 * age of what is on screen. Undefined when there is neither.
 */
export function findMomentTheLatenessCountsFrom(status: DataSourceStatus): number | undefined {
  if (status.failingSinceMs !== undefined) {
    return status.failingSinceMs;
  }
  return status.lastOkAtMs;
}

/** How many sources that are on read ok, late and in error. */
export type DataSourceHealthCounts = {
  okCount: number;
  staleCount: number;
  errorCount: number;
};

/**
 * Counts the sources that are on by health at `nowMs` (server clock), for the header
 * chip, by the same rule as each row's chip; sources that are off are left out.
 */
export function countEnabledDataSourcesByHealth(
  sources: DataSource[],
  nowMs: number,
): DataSourceHealthCounts {
  const counts: DataSourceHealthCounts = { okCount: 0, staleCount: 0, errorCount: 0 };
  for (const source of sources) {
    const health = findHealthOfDataSource(source, nowMs);
    if (health === 'ok') {
      counts.okCount += 1;
    } else if (health === 'stale') {
      counts.staleCount += 1;
    } else if (health === 'error') {
      counts.errorCount += 1;
    }
  }
  return counts;
}

const millisecondsPerSecond = 1_000;
const secondsPerMinute = 60;

/**
 * Writes how long ago a moment of the server was, for the amber chip: "há 40 s" under a
 * minute, where the page's usual "agora" would hide that a source is late at all, then
 * "há 3 min", "há 2 h" (formatRelativeTimePtBR). `nowMs` is on the server's clock too; a
 * moment ahead of it (a poll stamped after the page last read "now") reads "há 0 s".
 */
export function describeTimeSinceMoment(pastMomentMs: number, nowMs: number): string {
  const elapsedMs = Math.max(0, nowMs - pastMomentMs);
  const elapsedSeconds = Math.floor(elapsedMs / millisecondsPerSecond);
  if (elapsedSeconds < secondsPerMinute) {
    return ptBR.dataSources.secondsAgo(elapsedSeconds);
  }
  return formatRelativeTimePtBR(new Date(pastMomentMs), new Date(nowMs));
}
