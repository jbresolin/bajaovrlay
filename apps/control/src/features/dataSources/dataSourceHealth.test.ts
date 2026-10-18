/**
 * Health of a data source, as the page tells it (apps/control)
 *
 * What this module is for:
 *   The "Fontes" page and the header chip sum a source's status up in one word: "Ok",
 *   "Atrasada" (late: the data shown is old), "Erro" (nothing to show at all) or
 *   "Desligada". The server owns the truth (`status.isStale`); this module only reads
 *   it, never works staleness out from the clock. It also counts the sources that are on,
 *   for "Fontes: 2 ok · 1 atrasada", and writes how long ago the last good data came.
 *
 * What these tests prove:
 *   - The word for each kind of status, including the two ways a source fails: late
 *     with old data kept (a failing simulator reads "Atrasada", as the e2e expects) and
 *     failing before it ever had data ("Erro"); a source marked late after a restart,
 *     with neither data nor an error yet, reads "Atrasada", not "Erro".
 *   - The header counts leave the sources that are off out.
 *   - "há 40 s" under a minute, then the page's usual "há 3 min".
 *
 * What these tests deliberately do not cover:
 *   - The chip on the page, its colour and its tooltip: DataSourcesPage.test.tsx and
 *     DataSourcesHealthChip.test.tsx.
 */
import type { DataSource } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildRehearsalReplayThatIsOk,
  buildSeededSimulatorThatIsOff,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsStale,
  buildSimulatorThatNeverHadData,
  momentOfTheSamplesMs,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  countEnabledDataSourcesByHealth,
  type DataSourceHealth,
  describeTimeSinceLastGoodData,
  findHealthOfDataSource,
} from './dataSourceHealth';

/** The simulator right after a restart: on, marked late, never polled, no error yet. */
function buildSimulatorMarkedLateByARestartBeforeItsFirstPoll(): DataSource {
  const source = buildSimulatorThatNeverHadData();
  return {
    ...source,
    status: {
      isStale: true,
      lastError: null,
      consecutiveFailures: 0,
      staleAfterMs: source.status.staleAfterMs,
      recordingError: null,
    },
  };
}

const healthScenarios: { name: string; source: DataSource; expected: DataSourceHealth }[] = [
  // The everyday case: on, and the last poll was good.
  { name: 'a healthy source is ok', source: buildSimulatorThatIsOk(), expected: 'ok' },
  // "Falha simulada" on: polls fail, the last good data stays and is late.
  {
    name: 'a failing source that had data is stale',
    source: buildSimulatorThatIsStale(),
    expected: 'stale',
  },
  // Failing since it was turned on: there is no data to be late, only the error.
  {
    name: 'a failing source that never had data is in error',
    source: buildSimulatorThatNeverHadData(),
    expected: 'error',
  },
  // Right after a restart the server marks every source that is on as late; one that
  // never had data and has no error yet is waiting for its first poll, not failing.
  {
    name: 'a source marked late with no data and no error yet is stale, not in error',
    source: buildSimulatorMarkedLateByARestartBeforeItsFirstPoll(),
    expected: 'stale',
  },
  // The seeded simulator before anyone turns it on.
  { name: 'a source that is off is off', source: buildSeededSimulatorThatIsOff(), expected: 'off' },
  // Off wins over everything else: a stale source turned off is off, not late.
  {
    name: 'a stale source turned off is off',
    source: { ...buildSimulatorThatIsStale(), isEnabled: false },
    expected: 'off',
  },
];

describe('findHealthOfDataSource', () => {
  it.each(healthScenarios)('$name', ({ source, expected }) => {
    // Arrange: the source comes from the scenario row above.

    // Act: sum its status up.
    const health = findHealthOfDataSource(source);

    // Assert: the word the row expects.
    expect(health, `"${source.label}" must read as ${expected}`).toBe(expected);
  });
});

describe('countEnabledDataSourcesByHealth', () => {
  it('counts the sources that are on by health and leaves the ones that are off out', () => {
    // Arrange: two healthy sources, one late, one that never had data and one off.
    const sources: DataSource[] = [
      buildSimulatorThatIsOk(),
      buildRehearsalReplayThatIsOk(),
      { ...buildSimulatorThatIsStale(), id: 'simulador-falhando', label: 'Simulador falhando' },
      { ...buildSimulatorThatNeverHadData(), id: 'simulador-sem-dados', label: 'Sem dados' },
      { ...buildSeededSimulatorThatIsOff(), id: 'simulador-desligado', label: 'Desligado' },
    ];

    // Act: count them.
    const counts = countEnabledDataSourcesByHealth(sources);

    // Assert: 2 ok, 1 late, 1 in error; the source that is off is in no count.
    expect(counts, 'only the sources that are on are counted, each once').toEqual({
      okCount: 2,
      staleCount: 1,
      errorCount: 1,
    });
  });
});

const timeSinceScenarios = [
  // A source late for 40 s: "agora" would hide that it is late at all.
  { name: 'writes seconds under a minute', elapsedMs: 40_000, expected: 'há 40 s' },
  // The first second: still written as seconds, never "agora".
  { name: 'writes 0 s right at the moment', elapsedMs: 300, expected: 'há 0 s' },
  // From a minute on, the page's usual relative time.
  { name: 'writes minutes from a minute on', elapsedMs: 185_000, expected: 'há 3 min' },
];

describe('describeTimeSinceLastGoodData', () => {
  it.each(timeSinceScenarios)('$name', ({ elapsedMs, expected }) => {
    // Arrange: "now" is the row's time after the last good data.
    const nowMs = momentOfTheSamplesMs + elapsedMs;

    // Act: write the time since the last good data.
    const text = describeTimeSinceLastGoodData(momentOfTheSamplesMs, nowMs);

    // Assert: the text the row expects.
    expect(text, `${elapsedMs} ms after the last good data must read "${expected}"`).toBe(expected);
  });
});
