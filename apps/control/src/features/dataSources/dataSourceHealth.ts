import type { DataSource } from '@bajaovrlay/shared';

import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';

/**
 * How a source is doing, in one word, as the page shows it:
 * - `off`: the source is turned off ("Desligada");
 * - `error`: it is failing and never had good data, so there is nothing to show ("Erro");
 * - `stale`: its data is late — the last poll failed or nothing new came — but the last
 *   good data is still there and shown ("Atrasada"); also a source the server marked
 *   late with no error yet, as every source that is on is right after a restart;
 * - `ok`: on and fresh ("Ok").
 */
export type DataSourceHealth = 'ok' | 'stale' | 'error' | 'off';

/**
 * Sums a source's status up. The server owns the truth: lateness is `status.isStale` as
 * the server sent it, never worked out here from the clock. A failing source that had
 * data reads "Atrasada" (its data stays on screen, rule 4), with the reason in a tooltip;
 * "Erro" is kept for a source with a reason to show and nothing else: no good data
 * ever, and an error from the server. A source just turned on, before its first poll
 * answers, reads "Ok" for that moment; after a restart the server marks it late until
 * then, so it reads "Atrasada" with no reason rather than a red "Erro" with none.
 */
export function findHealthOfDataSource(source: DataSource): DataSourceHealth {
  if (!source.isEnabled) {
    return 'off';
  }
  if (!source.status.isStale) {
    return 'ok';
  }
  const hasEverHadGoodData = source.status.lastOkAtMs !== undefined;
  const hasAnErrorToShow = source.status.lastError !== null;
  if (!hasEverHadGoodData && hasAnErrorToShow) {
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

/** Counts the sources that are on by health, for the header chip; sources that are off are left out. */
export function countEnabledDataSourcesByHealth(sources: DataSource[]): DataSourceHealthCounts {
  const counts: DataSourceHealthCounts = { okCount: 0, staleCount: 0, errorCount: 0 };
  for (const source of sources) {
    const health = findHealthOfDataSource(source);
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
