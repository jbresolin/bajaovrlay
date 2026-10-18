/**
 * Health of a data source, as the page tells it (apps/control)
 *
 * What this module is for:
 *   The "Fontes" page and the header chip sum a source's status up in one word: "Ok",
 *   "Atrasada" (amber: late, the data shown is old), "Erro" (red: failing for a minute or
 *   more, or never had data) or "Desligada". The server owns staleness
 *   (`status.isStale`) and records when the failing started (`status.failingSinceMs`);
 *   the page only adds the minute rule, counted on the server's clock from
 *   failingSinceMs (João's ruling 4 at gate 2 of PR #16, and his re-check: not from the
 *   last good data, which stands still while a source repeats the same data). It also
 *   counts the sources that are on, for "Fontes: 2 ok · 1 atrasada · 1 com erro", and
 *   writes how long a source has been late.
 *
 * What these tests prove:
 *   - The word for each kind of status: a failing source reads "Atrasada" up to 59 s
 *     after it started failing and "Erro" from 60 s on, also when its data had stood
 *     still for ten minutes before; one failing before it ever had data reads "Erro";
 *     one marked late by a restart, with no error yet, reads "Atrasada" however old its
 *     data, because it is waiting for its first poll, not failing; a source that is off
 *     reads "Desligada" whatever its status; one failing with no failingSinceMs (a
 *     database written before the field) stays "Atrasada" until a failed poll sets it.
 *   - The header counts follow the same rule and leave the sources that are off out.
 *   - The amber text counts from when the failing started, or, after a restart, from the
 *     last good data; "há 40 s" under a minute, then the page's usual "há 3 min".
 *
 * What these tests deliberately do not cover:
 *   - The chip on the page, its colour, its tooltip and turning red as time passes:
 *     DataSourcesPage.test.tsx and DataSourcesHealthChip.test.tsx.
 *   - The server setting and clearing failingSinceMs: recordDataSourcePollFailingSince.test.ts
 *     in apps/server.
 */
import type { DataSource } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildRehearsalReplayThatIsOk,
  buildSeededSimulatorThatIsOff,
  buildSimulatorFailingAfterItsDataStoodStillForTenMinutes,
  buildSimulatorMarkedLateByARestart,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsStale,
  buildSimulatorThatNeverHadData,
  momentOfTheSamplesMs,
  momentTheSimulatorStartedFailingMs,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  countEnabledDataSourcesByHealth,
  type DataSourceHealth,
  describeTimeSinceMoment,
  findHealthOfDataSource,
  findMomentTheLatenessCountsFrom,
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

/**
 * The failing simulator as a database written before failingSinceMs existed hands it
 * back: late, with an error and its last good data, but no moment the failing started.
 */
function buildSimulatorFailingWithNoFailingSinceFromAnOlderDatabase(): DataSource {
  const source = buildSimulatorThatIsStale();
  const statusAsAnOlderDatabaseStoredIt = { ...source.status };
  delete statusAsAnOlderDatabaseStoredIt.failingSinceMs;
  return { ...source, status: statusAsAnOlderDatabaseStoredIt };
}

// Every row reads "now" this many milliseconds after one fixed moment on the server's
// clock: momentTheSimulatorStartedFailingMs, when the failing simulators had their first
// failed poll (their last good data came two seconds before that). Rows whose source is
// not failing use that moment only as the clock; their why-comment says how old the data is.
const healthScenarios: {
  name: string;
  source: DataSource;
  millisecondsAfterTheSimulatorStartedFailing: number;
  expected: DataSourceHealth;
}[] = [
  // The everyday case: on, and the last poll was good.
  {
    name: 'a healthy source is ok',
    source: buildSimulatorThatIsOk(),
    millisecondsAfterTheSimulatorStartedFailing: 0,
    expected: 'ok',
  },
  // "Falha simulada" on for under a minute: the last good data stays, amber.
  {
    name: 'a source failing for 59 s is stale',
    source: buildSimulatorThatIsStale(),
    millisecondsAfterTheSimulatorStartedFailing: 59_000,
    expected: 'stale',
  },
  // The minute is up: the same source turns red, its data still on screen.
  {
    name: 'a source failing for 60 s is in error',
    source: buildSimulatorThatIsStale(),
    millisecondsAfterTheSimulatorStartedFailing: 60_000,
    expected: 'error',
  },
  // Long past the minute: still red, never back to amber on its own.
  {
    name: 'a source failing for 10 min is in error',
    source: buildSimulatorThatIsStale(),
    millisecondsAfterTheSimulatorStartedFailing: 600_000,
    expected: 'error',
  },
  // João's re-check: data that stood still for ten minutes is not ten minutes of failing.
  {
    name: 'a source whose data stood still for 10 min reads stale at its first failure',
    source: buildSimulatorFailingAfterItsDataStoodStillForTenMinutes(),
    millisecondsAfterTheSimulatorStartedFailing: 1_000,
    expected: 'stale',
  },
  // The same source a minute after it started failing: now it is red.
  {
    name: 'a source whose data stood still for 10 min is in error a minute after it failed',
    source: buildSimulatorFailingAfterItsDataStoodStillForTenMinutes(),
    millisecondsAfterTheSimulatorStartedFailing: 60_000,
    expected: 'error',
  },
  // Failing since it was turned on: there is no data to be late, only the error.
  {
    name: 'a failing source that never had data is in error',
    source: buildSimulatorThatNeverHadData(),
    millisecondsAfterTheSimulatorStartedFailing: 0,
    expected: 'error',
  },
  // Right after a restart the server marks every source that is on as late; one that
  // never had data and has no error yet is waiting for its first poll, not failing.
  {
    name: 'a source marked late with no data and no error yet is stale, not in error',
    source: buildSimulatorMarkedLateByARestartBeforeItsFirstPoll(),
    millisecondsAfterTheSimulatorStartedFailing: 0,
    expected: 'stale',
  },
  // The same after a restart with data 5 min 2 s old (its last good poll came 2 s before
  // the fixed moment): not failing yet, so not red; the poller gives it a reason ("Sem
  // dados novos…") and a failingSinceMs if its polls fail.
  {
    name: 'a source marked late by a restart with no error yet stays stale past a minute',
    source: buildSimulatorMarkedLateByARestart(),
    millisecondsAfterTheSimulatorStartedFailing: 300_000,
    expected: 'stale',
  },
  // The seeded simulator before anyone turns it on.
  {
    name: 'a source that is off is off',
    source: buildSeededSimulatorThatIsOff(),
    millisecondsAfterTheSimulatorStartedFailing: 0,
    expected: 'off',
  },
  // Off wins over everything else: a source failing for minutes, turned off, is off.
  {
    name: 'a failing source turned off is off, however long it failed',
    source: { ...buildSimulatorThatIsStale(), isEnabled: false },
    millisecondsAfterTheSimulatorStartedFailing: 600_000,
    expected: 'off',
  },
  // A database written before failingSinceMs existed: an error but no moment the failing
  // started, so the page cannot count the minute and keeps it amber until the next failed
  // poll sets the moment, however long it has really failed.
  {
    name: 'a failing source with no failingSinceMs (an older database) stays stale',
    source: buildSimulatorFailingWithNoFailingSinceFromAnOlderDatabase(),
    millisecondsAfterTheSimulatorStartedFailing: 600_000,
    expected: 'stale',
  },
];

describe('findHealthOfDataSource', () => {
  it.each(healthScenarios)(
    '$name',
    ({ source, millisecondsAfterTheSimulatorStartedFailing, expected }) => {
      // Arrange: "now" on the server's clock, the row's time after the fixed moment.
      const nowMs =
        momentTheSimulatorStartedFailingMs + millisecondsAfterTheSimulatorStartedFailing;

      // Act: sum its status up.
      const health = findHealthOfDataSource(source, nowMs);

      // Assert: the word the row expects.
      expect(health, `"${source.label}" must read as ${expected}`).toBe(expected);
    },
  );
});

describe('countEnabledDataSourcesByHealth', () => {
  it('counts the sources that are on by the same rule and leaves the ones that are off out', () => {
    // Arrange: two healthy sources, one failing for 40 s, one that never had data and
    // one off, read 40 s after the failing started.
    const sources: DataSource[] = [
      buildSimulatorThatIsOk(),
      buildRehearsalReplayThatIsOk(),
      { ...buildSimulatorThatIsStale(), id: 'simulador-falhando', label: 'Simulador falhando' },
      { ...buildSimulatorThatNeverHadData(), id: 'simulador-sem-dados', label: 'Sem dados' },
      { ...buildSeededSimulatorThatIsOff(), id: 'simulador-desligado', label: 'Desligado' },
    ];
    const nowMs = momentTheSimulatorStartedFailingMs + 40_000;

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
    // Arrange: the failing simulator, read 60 s after it started failing.
    const sources: DataSource[] = [buildSimulatorThatIsStale()];
    const nowMs = momentTheSimulatorStartedFailingMs + 60_000;

    // Act: count it.
    const counts = countEnabledDataSourcesByHealth(sources, nowMs);

    // Assert: in error, as its chip reads.
    expect(counts, 'the header must count it as its row chip reads it: "Erro"').toEqual({
      okCount: 0,
      staleCount: 0,
      errorCount: 1,
    });
  });

  it('counts a source whose data stood still for 10 min as late at its first failure', () => {
    // Arrange: the simulator whose data stood still for ten minutes, read a second after
    // its first failed poll.
    const sources: DataSource[] = [buildSimulatorFailingAfterItsDataStoodStillForTenMinutes()];
    const nowMs = momentTheSimulatorStartedFailingMs + 1_000;

    // Act: count it.
    const counts = countEnabledDataSourcesByHealth(sources, nowMs);

    // Assert: late, not in error: it has failed for a second, not for ten minutes.
    expect(counts, 'the header must count the minute from the first failure').toEqual({
      okCount: 0,
      staleCount: 1,
      errorCount: 0,
    });
  });
});

const latenessStartScenarios: {
  name: string;
  source: DataSource;
  expectedMomentMs: number | undefined;
}[] = [
  // Failing: late since the first failed poll, whatever the age of the data.
  {
    name: 'counts a failing source from when it started failing',
    source: buildSimulatorFailingAfterItsDataStoodStillForTenMinutes(),
    expectedMomentMs: momentTheSimulatorStartedFailingMs,
  },
  // After a restart nothing is failing yet: the data on screen is as old as its last
  // good poll, so that is what the amber text tells.
  {
    name: 'counts a source marked late by a restart from its last good data',
    source: buildSimulatorMarkedLateByARestart(),
    expectedMomentMs: momentOfTheSamplesMs,
  },
  // Healthy: the function still hands back its last good data; the chip never shows it,
  // because it asks only when the source reads "Atrasada".
  {
    name: 'counts a healthy source from its last good data',
    source: buildSimulatorThatIsOk(),
    expectedMomentMs: momentOfTheSamplesMs,
  },
  // Never polled and not failing: there is no moment to count from.
  {
    name: 'has no moment for a source that was never polled and is not failing',
    source: buildSeededSimulatorThatIsOff(),
    expectedMomentMs: undefined,
  },
];

describe('findMomentTheLatenessCountsFrom', () => {
  it.each(latenessStartScenarios)('$name', ({ source, expectedMomentMs }) => {
    // Arrange: the row's source (built above).

    // Act: find the moment its amber text counts from.
    const momentMs = findMomentTheLatenessCountsFrom(source.status);

    // Assert: the moment the row expects.
    expect(momentMs, `"${source.label}" must count its lateness from this moment`).toBe(
      expectedMomentMs,
    );
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

describe('describeTimeSinceMoment', () => {
  it.each(timeSinceScenarios)('$name', ({ elapsedMs, expected }) => {
    // Arrange: "now" is the row's time after the moment the lateness counts from.
    const nowMs = momentTheSimulatorStartedFailingMs + elapsedMs;

    // Act: write the time since that moment.
    const text = describeTimeSinceMoment(momentTheSimulatorStartedFailingMs, nowMs);

    // Assert: the text the row expects.
    expect(text, `${elapsedMs} ms after that moment must read "${expected}"`).toBe(expected);
  });
});
