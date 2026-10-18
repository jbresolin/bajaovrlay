/**
 * Health of a data source, as the page tells it (apps/control)
 *
 * What this module is for:
 *   The "Fontes" page and the header chip sum a source's status up in one word: "Ok",
 *   "Atrasada" (amber: late, the data shown is old), "Erro" (red: failing for a minute or
 *   more, or never had data) or "Desligada". The server owns staleness
 *   (`status.isStale`); the page only adds the minute rule of João's ruling 4 at gate 2
 *   of PR #16, counted on the server's clock from the last good data (`lastOkAtMs`). It
 *   also counts the sources that are on, for "Fontes: 2 ok · 1 atrasada · 1 com erro",
 *   and writes how long ago the last good data came.
 *
 * What these tests prove:
 *   - The word for each kind of status: a failing source with old data reads "Atrasada"
 *     up to 59 s after its last good data and "Erro" from 60 s on; one failing before it
 *     ever had data reads "Erro"; one marked late by a restart, with no error yet, reads
 *     "Atrasada" however old its data, because it is waiting for its first poll, not
 *     failing; a source that is off reads "Desligada" whatever its status.
 *   - The header counts follow the same rule and leave the sources that are off out.
 *   - "há 40 s" under a minute, then the page's usual "há 3 min".
 *
 * What these tests deliberately do not cover:
 *   - The chip on the page, its colour, its tooltip and turning red as time passes:
 *     DataSourcesPage.test.tsx and DataSourcesHealthChip.test.tsx.
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

/** The healthy simulator after a restart: its old data kept, marked late, no error yet. */
function buildSimulatorWithOldDataMarkedLateByARestart(): DataSource {
  const source = buildSimulatorThatIsOk();
  return {
    ...source,
    status: { ...source.status, isStale: true, lastError: null, consecutiveFailures: 0 },
  };
}

// The stale samples had their last good data at the moment of the samples; each row reads
// "now" this many milliseconds later, on the server's clock.
const healthScenarios: {
  name: string;
  source: DataSource;
  millisecondsAfterTheLastGoodData: number;
  expected: DataSourceHealth;
}[] = [
  // The everyday case: on, and the last poll was good.
  {
    name: 'a healthy source is ok',
    source: buildSimulatorThatIsOk(),
    millisecondsAfterTheLastGoodData: 2_000,
    expected: 'ok',
  },
  // "Falha simulada" on for under a minute: the last good data stays, amber.
  {
    name: 'a source failing for 59 s after its last good data is stale',
    source: buildSimulatorThatIsStale(),
    millisecondsAfterTheLastGoodData: 59_000,
    expected: 'stale',
  },
  // The minute is up: the same source turns red, its data still on screen.
  {
    name: 'a source failing for 60 s after its last good data is in error',
    source: buildSimulatorThatIsStale(),
    millisecondsAfterTheLastGoodData: 60_000,
    expected: 'error',
  },
  // Long past the minute: still red, never back to amber on its own.
  {
    name: 'a source failing for 10 min after its last good data is in error',
    source: buildSimulatorThatIsStale(),
    millisecondsAfterTheLastGoodData: 600_000,
    expected: 'error',
  },
  // Failing since it was turned on: there is no data to be late, only the error.
  {
    name: 'a failing source that never had data is in error',
    source: buildSimulatorThatNeverHadData(),
    millisecondsAfterTheLastGoodData: 0,
    expected: 'error',
  },
  // Right after a restart the server marks every source that is on as late; one that
  // never had data and has no error yet is waiting for its first poll, not failing.
  {
    name: 'a source marked late with no data and no error yet is stale, not in error',
    source: buildSimulatorMarkedLateByARestartBeforeItsFirstPoll(),
    millisecondsAfterTheLastGoodData: 0,
    expected: 'stale',
  },
  // The same after a restart with data from minutes ago: not failing yet, so not red; the
  // poller gives it a reason ("Sem dados novos…") if its first polls fail.
  {
    name: 'a source marked late by a restart with no error yet stays stale past a minute',
    source: buildSimulatorWithOldDataMarkedLateByARestart(),
    millisecondsAfterTheLastGoodData: 300_000,
    expected: 'stale',
  },
  // The seeded simulator before anyone turns it on.
  {
    name: 'a source that is off is off',
    source: buildSeededSimulatorThatIsOff(),
    millisecondsAfterTheLastGoodData: 0,
    expected: 'off',
  },
  // Off wins over everything else: a source failing for minutes, turned off, is off.
  {
    name: 'a failing source turned off is off, however long it failed',
    source: { ...buildSimulatorThatIsStale(), isEnabled: false },
    millisecondsAfterTheLastGoodData: 600_000,
    expected: 'off',
  },
];

describe('findHealthOfDataSource', () => {
  it.each(healthScenarios)('$name', ({ source, millisecondsAfterTheLastGoodData, expected }) => {
    // Arrange: "now" on the server's clock, the row's time after the last good data.
    const nowMs = momentOfTheSamplesMs + millisecondsAfterTheLastGoodData;

    // Act: sum its status up.
    const health = findHealthOfDataSource(source, nowMs);

    // Assert: the word the row expects.
    expect(health, `"${source.label}" must read as ${expected}`).toBe(expected);
  });
});

describe('countEnabledDataSourcesByHealth', () => {
  it('counts the sources that are on by the same rule and leaves the ones that are off out', () => {
    // Arrange: two healthy sources, one failing for 40 s, one that never had data and
    // one off, read 40 s after the last good data.
    const sources: DataSource[] = [
      buildSimulatorThatIsOk(),
      buildRehearsalReplayThatIsOk(),
      { ...buildSimulatorThatIsStale(), id: 'simulador-falhando', label: 'Simulador falhando' },
      { ...buildSimulatorThatNeverHadData(), id: 'simulador-sem-dados', label: 'Sem dados' },
      { ...buildSeededSimulatorThatIsOff(), id: 'simulador-desligado', label: 'Desligado' },
    ];
    const nowMs = momentOfTheSamplesMs + 40_000;

    // Act: count them.
    const counts = countEnabledDataSourcesByHealth(sources, nowMs);

    // Assert: 2 ok, 1 late, 1 in error; the source that is off is in no count.
    expect(counts, 'only the sources that are on are counted, each once').toEqual({
      okCount: 2,
      staleCount: 1,
      errorCount: 1,
    });
  });

  it('counts a source failing for a minute as in error, not late', () => {
    // Arrange: the failing simulator, read 60 s after its last good data.
    const sources: DataSource[] = [buildSimulatorThatIsStale()];
    const nowMs = momentOfTheSamplesMs + 60_000;

    // Act: count it.
    const counts = countEnabledDataSourcesByHealth(sources, nowMs);

    // Assert: in error, as its chip reads.
    expect(counts, 'the header must count it as its row chip reads it: "Erro"').toEqual({
      okCount: 0,
      staleCount: 0,
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
