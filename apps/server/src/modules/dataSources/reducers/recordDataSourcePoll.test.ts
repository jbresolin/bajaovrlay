/**
 * Recording one poll of a data source: the recordDataSourcePoll reducer (apps/server)
 *
 * What this module is for:
 *   Every poll the server's poller makes ends in recordDataSourcePoll, good or failed.
 *   A good poll replaces the source's snapshot and marks it healthy; a failed one keeps
 *   the last good snapshot and marks the source stale ("atrasada"), so nothing on air is
 *   ever blanked by a failure (rule 4). A good poll whose shapes do not validate is a
 *   failure: a poll never half-succeeds. Because a poll arrives every two seconds, the
 *   reducer also says when a poll is routine, so the store leaves it out of the event
 *   log (decision D11), and hands back the same slices when nothing changed (D7).
 *
 * What these tests prove:
 *   - A good poll stores the shapes and the time, and clears the error and the count.
 *   - A failure keeps the snapshot and the last success, marks stale and counts.
 *   - A payload that fails its shape, names a shape that does not exist, or carries no
 *     shape at all is a failure whose pt-BR error says why (naming the path when there
 *     is one); nothing of it is kept. A failure with an empty error reads a pt-BR fallback.
 *   - A good poll after failures clears stale (the recovery).
 *   - A good poll repeating the stored shapes on a healthy source hands back the very
 *     same slices (no trace); the same shapes on a stale source still recover it.
 *   - A good poll of a recording source counts one more snapshot in its recording.
 *   - A poll of a source deleted or turned off a moment ago changes nothing.
 *   - The event-log flag, row by row: left out while the health (stale, error text) holds,
 *     kept when the source goes stale, recovers, or its error changes.
 *
 * What these tests deliberately do not cover:
 *   - The store skipping the row and the broadcast; dataSourcePollsOnTheStore.test.ts.
 *   - Who may send this command; authorizeDataSourceCommands.test.ts in core/store.
 */
import type { DataSource } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSimulatorTurnedOff,
  buildGreenFlagSessionAt,
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  buildRecordingOpenSince1430,
  buildSaturdayRecording,
  buildSimulatorSnapshotReceivedAt,
  buildStaleEnduroSimulator,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

/** The moment the poll the tests record was made: the moment of the command. */
const momentOfThePollMs = momentOfTheCommandMs;

/** Builds the poller's good poll of the green-flag session, made at a moment. */
function buildGoodSessionPollAt(receivedAtMs: number) {
  return {
    type: 'recordDataSourcePoll' as const,
    sourceId: 'simulador-enduro',
    result: {
      ok: true as const,
      shapes: { session: buildGreenFlagSessionAt(receivedAtMs) },
      receivedAtMs,
    },
  };
}

/** Builds the poller's failed poll, with the simulator's "Falha simulada." or another error. */
function buildFailedPoll(error: string) {
  return {
    type: 'recordDataSourcePoll' as const,
    sourceId: 'simulador-enduro',
    result: { ok: false as const, error, attemptedAtMs: momentOfThePollMs },
  };
}

describe('recordDataSourcePoll, a good poll', () => {
  it('stores the shapes and the time, and clears the error and the failure count', () => {
    // Arrange: the simulator stale after three failures, with old data.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildStaleEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 8_000)],
    });

    // Act: record a good poll.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      buildGoodSessionPollAt(momentOfThePollMs),
      contextOfTheDataSourceCommand,
    );

    // Assert: the new snapshot, and a healthy status stamped with the poll's moment.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.dataSnapshots, 'the new shapes must replace the old ones').toEqual([
      buildSimulatorSnapshotReceivedAt(momentOfThePollMs),
    ]);
    expect(slicesAfter?.dataSources[0]?.status, 'the source must be healthy again').toEqual({
      lastAttemptAtMs: momentOfThePollMs,
      lastOkAtMs: momentOfThePollMs,
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 6_000,
      recordingError: null,
    });
  });

  it('counts one more snapshot in the open recording of a recording source', () => {
    // Arrange: the simulator healthy and recording since 14:30 (62 snapshots so far).
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildHealthyEnduroSimulator(), isRecording: true }],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 2_000)],
      recordings: [buildSaturdayRecording(), buildRecordingOpenSince1430()],
    });

    // Act: record a good poll with new data.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      buildGoodSessionPollAt(momentOfThePollMs),
      contextOfTheDataSourceCommand,
    );

    // Assert: 63 snapshots in today's recording; Saturday's untouched.
    const recordingsAfter = outcome.status === 'applied' ? outcome.slices.recordings : [];
    expect(recordingsAfter, 'the open recording must count the new snapshot').toEqual([
      buildSaturdayRecording(),
      buildRecordingOpenSince1430(63),
    ]);
  });

  it('hands back the very same slices when a healthy source repeats its stored shapes', () => {
    // Arrange: the simulator healthy, its stored snapshot made two seconds ago.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 2_000)],
    });

    // Act: a new poll answers exactly the same session (same updatedAtMs and all).
    const repeatedPoll = buildGoodSessionPollAt(momentOfThePollMs - 2_000);
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { ...repeatedPoll, result: { ...repeatedPoll.result, receivedAtMs: momentOfThePollMs } },
      contextOfTheDataSourceCommand,
    );

    // Assert: the same slices, so the store saves, logs and broadcasts nothing.
    expect(outcome, 'a repeat on a healthy source must leave no trace').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
    expect(
      outcome.status === 'applied' ? outcome.slices.dataSnapshots : undefined,
      'the snapshots must be the very same array',
    ).toBe(slicesBefore.dataSnapshots);
  });

  it('recovers a stale source even when the shapes repeat the stored ones', () => {
    // Arrange: the simulator stale, its stored snapshot from eight seconds ago.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildStaleEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 8_000)],
    });

    // Act: a good poll answers the same session again.
    const repeatedPoll = buildGoodSessionPollAt(momentOfThePollMs - 8_000);
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { ...repeatedPoll, result: { ...repeatedPoll.result, receivedAtMs: momentOfThePollMs } },
      contextOfTheDataSourceCommand,
    );

    // Assert: no longer stale: the source answered.
    const statusAfter =
      outcome.status === 'applied' ? outcome.slices.dataSources[0]?.status : undefined;
    expect(statusAfter?.isStale, 'an answer recovers the source').toBe(false);
  });
});

describe('recordDataSourcePoll, a failed poll', () => {
  it('keeps the snapshot and the last success, marks stale and counts the failure', () => {
    // Arrange: the simulator healthy, with its data of two seconds ago.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 2_000)],
    });

    // Act: the poll fails.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      buildFailedPoll('Falha simulada.'),
      contextOfTheDataSourceCommand,
    );

    // Assert: same snapshot; stale, with the error, one failure, last success unchanged.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.dataSnapshots, 'the last good data must stay (rule 4)').toBe(
      slicesBefore.dataSnapshots,
    );
    expect(slicesAfter?.dataSources[0]?.status, 'the source must read as late').toEqual({
      lastAttemptAtMs: momentOfThePollMs,
      lastOkAtMs: momentOfThePollMs - 2_000,
      lastError: 'Falha simulada.',
      consecutiveFailures: 1,
      isStale: true,
      staleAfterMs: 6_000,
      recordingError: null,
    });
  });

  const invalidPayloadScenarios = [
    // A car in a status the shape does not know: the operator reads where.
    {
      name: 'treats a positions entry with an unknown status as a failure naming the path',
      shapes: {
        positions: {
          sessionId: 'enduro-2027-nacional',
          updatedAtMs: momentOfThePollMs,
          entries: [
            {
              position: 1,
              carNumber: 42,
              teamName: 'Carcará Baja',
              schoolName: 'UFPR',
              laps: 6,
              status: 'flying',
            },
          ],
        },
      },
      expectedErrorStart: 'Dados inválidos em "positions.entries.0.status"',
    },
    // One good shape does not rescue a bad one: a poll never half-succeeds.
    {
      name: 'refuses the good session too when the standings beside it are bad',
      shapes: {
        session: buildGreenFlagSessionAt(momentOfThePollMs),
        standings: { scope: 'overall', updatedAtMs: momentOfThePollMs },
      },
      expectedErrorStart: 'Dados inválidos em "standings.entries"',
    },
    // A shape name nobody declared is a bug in the adapter, named as such.
    {
      name: 'treats a shape name that does not exist as a failure naming it',
      shapes: { weather: { temperatureC: 31 } },
      expectedErrorStart: 'Dados inválidos em "weather"',
    },
    // An adapter that answered nothing: storing it would blank the last good data (rule 4).
    {
      name: 'treats a good poll with no shape at all as a failure',
      shapes: {},
      expectedErrorStart: 'A fonte respondeu sem nenhum dado.',
    },
  ];

  it.each(invalidPayloadScenarios)('$name', ({ shapes, expectedErrorStart }) => {
    // Arrange: the simulator healthy, with its data of two seconds ago.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 2_000)],
    });

    // Act: record a "good" poll carrying this row's payload.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: { ok: true, shapes, receivedAtMs: momentOfThePollMs },
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: a failure: the old snapshot kept, stale, the pt-BR error naming the path.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    const statusAfter = slicesAfter?.dataSources[0]?.status;
    expect(slicesAfter?.dataSnapshots, 'nothing of a bad payload may be kept').toBe(
      slicesBefore.dataSnapshots,
    );
    expect(statusAfter?.isStale, 'a bad payload is a failed poll').toBe(true);
    expect(statusAfter?.consecutiveFailures, 'it counts as a failure').toBe(1);
    expect(
      statusAfter?.lastError?.startsWith(expectedErrorStart),
      'the error must say in pt-BR what was wrong, naming the path when there is one',
    ).toBe(true);
  });

  it('shows a pt-BR reason when the adapter failed without one', () => {
    // Arrange: the simulator healthy, with its data of two seconds ago.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 2_000)],
    });

    // Act: the poll fails with an empty error (an adapter threw `new Error()`).
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      buildFailedPoll(''),
      contextOfTheDataSourceCommand,
    );

    // Assert: stale, and the operator reads a sentence instead of an empty tooltip.
    const statusAfter =
      outcome.status === 'applied' ? outcome.slices.dataSources[0]?.status : undefined;
    expect(statusAfter?.isStale, 'a failure with no reason still makes the source stale').toBe(
      true,
    );
    expect(statusAfter?.lastError, 'a missing reason must read as the pt-BR fallback').toBe(
      'A leitura da fonte falhou sem dizer o motivo.',
    );
  });
});

describe('recordDataSourcePoll, a source that is gone or off', () => {
  const ignoredPollScenarios = [
    // The poller raced a delete: its last result arrives after the source is gone.
    { name: 'changes nothing for a source deleted a moment ago', dataSources: [] },
    // The poller raced the switch: the source was turned off a moment ago.
    {
      name: 'changes nothing for a source turned off a moment ago',
      dataSources: [buildEnduroSimulatorTurnedOff()],
    },
  ];

  it.each(ignoredPollScenarios)('$name', ({ dataSources }) => {
    // Arrange: this row's sources.
    const slicesBefore = buildRaceDaySlicesWithDataSources({ dataSources });

    // Act: the late poll arrives.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      buildGoodSessionPollAt(momentOfThePollMs),
      contextOfTheDataSourceCommand,
    );

    // Assert: accepted with the same slices: no refusal row for a race the poller lost.
    expect(outcome, 'a late poll must change nothing and not be refused').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
  });
});

describe('recordDataSourcePoll, the event-log flag', () => {
  const eventLogFlagScenarios: Array<{
    name: string;
    sourceBefore: DataSource;
    poll: ReturnType<typeof buildGoodSessionPollAt> | ReturnType<typeof buildFailedPoll>;
    isLeftOut: boolean;
  }> = [
    // Healthy and healthy again: the routine poll every two seconds.
    {
      name: 'leaves a routine good poll of a healthy source out of the log',
      sourceBefore: buildHealthyEnduroSimulator(),
      poll: buildGoodSessionPollAt(momentOfThePollMs),
      isLeftOut: true,
    },
    // The source goes stale: the operator's history must show when.
    {
      name: 'logs the failure that makes a healthy source stale',
      sourceBefore: buildHealthyEnduroSimulator(),
      poll: buildFailedPoll('Falha simulada.'),
      isLeftOut: false,
    },
    // Still failing, with the same error: nothing new to say.
    {
      name: 'leaves the same failure again out of the log',
      sourceBefore: buildStaleEnduroSimulator(),
      poll: buildFailedPoll('Falha simulada.'),
      isLeftOut: true,
    },
    // Still failing, but for another reason: worth a line.
    {
      name: 'logs a failure whose error changed',
      sourceBefore: buildStaleEnduroSimulator(),
      poll: buildFailedPoll('Tempo esgotado.'),
      isLeftOut: false,
    },
    // The source answers again: the recovery is in the history.
    {
      name: 'logs the good poll that recovers a stale source',
      sourceBefore: buildStaleEnduroSimulator(),
      poll: buildGoodSessionPollAt(momentOfThePollMs),
      isLeftOut: false,
    },
  ];

  it.each(eventLogFlagScenarios)('$name', ({ sourceBefore, poll, isLeftOut }) => {
    // Arrange: this row's source, with data of eight seconds ago.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [sourceBefore],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 8_000)],
    });

    // Act: record this row's poll.
    const outcome = reduceDataSourceCommand(slicesBefore, poll, contextOfTheDataSourceCommand);

    // Assert: applied, and left out of the log exactly as the row says.
    const isLeftOutOfTheEventLog =
      outcome.status === 'applied' && outcome.isLeftOutOfTheEventLog === true;
    expect(outcome.status, 'every poll of an enabled source is applied').toBe('applied');
    expect(isLeftOutOfTheEventLog, 'only a poll that keeps the health is left out').toBe(isLeftOut);
  });
});
