import type { DataSource } from '@bajaovrlay/shared';

import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';

/**
 * How a source is doing, in one word, as the page shows it:
 * - `off`: the source is turned off ("Desligada");
 * - `error`: it is failing and either never had good data, or has failed for a minute
 *   or more since its last good data ("Erro", red); its last data, if any, stays shown;
 * - `stale`: its data is late — failing for under a minute, or marked late by the server
 *   with no error yet, as every source that is on is right after a restart — and the
 *   last good data is still there and shown ("Atrasada", amber);
 * - `ok`: on and fresh ("Ok").
 */
export type DataSourceHealth = 'ok' | 'stale' | 'error' | 'off';

// João's ruling 4 at gate 2 of PR #16: amber "Atrasada" says "keep an eye on it"; after
// a minute of failing, the operator must act (or take the data off air), so it is red.
// Counted from `lastOkAtMs`. What could go wrong: the server does not rewrite lastOkAtMs
// on a poll that repeats the stored data (D7), so a source whose data stood still for
// minutes before it began to fail reads red at its first failure.
const failingTimeBeforeAStaleSourceIsInErrorMs = 60_000;

/**
 * Sums a source's status up at `nowMs`, a moment on the server's clock (as `lastOkAtMs`
 * is). The server owns staleness: `status.isStale` is as the server sent it. The page
 * adds only the minute rule: a late source with an error from the server reads "Erro"
 * once a minute has passed since its last good data, or at once if it never had any. A
 * late source with no error yet (after a restart, or just turned on again) is waiting for
 * a poll, not failing, so it reads "Atrasada" with no reason rather than a red "Erro"
 * with none; the poller gives it a reason if that poll does not come.
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
  const lastOkAtMs = source.status.lastOkAtMs;
  if (lastOkAtMs === undefined) {
    return 'error';
  }
  const millisecondsSinceTheLastGoodData = nowMs - lastOkAtMs;
  if (millisecondsSinceTheLastGoodData >= failingTimeBeforeAStaleSourceIsInErrorMs) {
    return 'error';
  }
  return 'stale';
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
 * Writes how long ago the last good data came: "há 40 s" under a minute, where the
 * page's usual "agora" would hide that a source is late at all, then "há 3 min", "há 2 h"
 * (formatRelativeTimePtBR). `nowMs` is on the server's clock, as `lastOkAtMs` is; a
 * moment ahead of it (a poll stamped after the page last read "now") reads "há 0 s".
 */
export function describeTimeSinceLastGoodData(lastOkAtMs: number, nowMs: number): string {
  const elapsedMs = Math.max(0, nowMs - lastOkAtMs);
  const elapsedSeconds = Math.floor(elapsedMs / millisecondsPerSecond);
  if (elapsedSeconds < secondsPerMinute) {
    return ptBR.dataSources.secondsAgo(elapsedSeconds);
  }
  return formatRelativeTimePtBR(new Date(lastOkAtMs), new Date(nowMs));
}
