/**
 * When a source started failing: failingSinceMs in recordDataSourcePoll (apps/server)
 *
 * What this module is for:
 *   The "Fontes" page turns a failing source red "Erro" once it has failed for a minute.
 *   That minute must count from when the failing started, not from the last change of
 *   data: the server does not rewrite lastOkAtMs on a poll that repeats the stored data
 *   (D7), so a source whose data stood still for ten minutes would read red at its first
 *   failure. So the server records `status.failingSinceMs` (João's gate 2 re-check on
 *   PR #16): set by the first failed poll, kept by the next ones, cleared by a success.
 *
 * What these tests prove:
 *   - The first failure after a success sets it to that poll's moment, also when the
 *     data had stood still for minutes before.
 *   - A second failure keeps it, and a success removes it.
 *   - A failure of a source that never had a good poll sets it too.
 *   - Every kind of failure sets it: an adapter's error, the poller's stale watch
 *     ("Sem dados novos há N s") and a payload that fails its shape.
 *   - A repeated good poll on a healthy source still changes nothing (D7): a healthy
 *     source has no failingSinceMs to change.
 *
 * What these tests deliberately do not cover:
 *   - The rest of a poll's outcome (snapshot, error, count, event-log flag):
 *     recordDataSourcePoll.test.ts.
 *   - Turning a source off clearing it: setDataSourceEnabled.test.ts.
 *   - It surviving a restart: dataSourceRestart.test.ts.
 *   - The chip's red and amber: dataSourceHealth.test.ts in apps/control.
 */
import type { DataSource, RecordDataSourcePollCommand } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSimulatorTurnedOff,
  buildGreenFlagSessionAt,
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  buildSimulatorSnapshotReceivedAt,
  buildStaleEnduroSimulator,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

/** The moment the poll each test records was made: the moment of the command. */
const momentOfThePollMs = momentOfTheCommandMs;

/** Builds the poller's good poll of the green-flag session, made at the moment of the poll. */
function buildGoodSessionPoll(): RecordDataSourcePollCommand {
  return {
    type: 'recordDataSourcePoll',
    sourceId: 'simulador-enduro',
    result: {
      ok: true,
      shapes: { session: buildGreenFlagSessionAt(momentOfThePollMs) },
      receivedAtMs: momentOfThePollMs,
    },
  };
}

/** Builds the poller's failed poll with this error, made at the moment of the poll. */
function buildFailedPoll(error: string): RecordDataSourcePollCommand {
  return {
    type: 'recordDataSourcePoll',
    sourceId: 'simulador-enduro',
    result: { ok: false, error, attemptedAtMs: momentOfThePollMs },
  };
}

/** Builds a "good" poll whose positions entry has a status the shape does not know. */
function buildPollWithAnInvalidPayload(): RecordDataSourcePollCommand {
  return {
    type: 'recordDataSourcePoll',
    sourceId: 'simulador-enduro',
    result: {
      ok: true,
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
      receivedAtMs: momentOfThePollMs,
    },
  };
}

/** Builds the simulator healthy, its data unchanged for ten minutes (lastOkAtMs then). */
function buildSimulatorWhoseDataStoodStillForTenMinutes(): DataSource {
  const healthySimulator = buildHealthyEnduroSimulator();
  return {
    ...healthySimulator,
    status: { ...healthySimulator.status, lastOkAtMs: momentOfThePollMs - 600_000 },
  };
}

/** Builds the simulator turned on and failing from its very first poll: no lastOkAtMs. */
function buildSimulatorThatNeverHadAGoodPoll(): DataSource {
  const turnedOffSimulator = buildEnduroSimulatorTurnedOff();
  return { ...turnedOffSimulator, isEnabled: true };
}

const failingSinceScenarios: {
  name: string;
  sourceBefore: DataSource;
  poll: RecordDataSourcePollCommand;
  expectedFailingSinceMs: number | undefined;
}[] = [
  // The ruling's own case: the minute must count from now, not from ten minutes ago.
  {
    name: 'sets it at the first failure after a success, though the data stood still for 10 min',
    sourceBefore: buildSimulatorWhoseDataStoodStillForTenMinutes(),
    poll: buildFailedPoll('Falha simulada.'),
    expectedFailingSinceMs: momentOfThePollMs,
  },
  // Still failing: the minute keeps counting from the first failure, six seconds ago.
  {
    name: 'keeps it at a second failure',
    sourceBefore: buildStaleEnduroSimulator(),
    poll: buildFailedPoll('Falha simulada.'),
    expectedFailingSinceMs: momentOfThePollMs - 6_000,
  },
  // A failure for another reason is the same failing, not a new one.
  {
    name: 'keeps it when the error of the next failure changes',
    sourceBefore: buildStaleEnduroSimulator(),
    poll: buildFailedPoll('Tempo esgotado: a fonte não respondeu em 2 s.'),
    expectedFailingSinceMs: momentOfThePollMs - 6_000,
  },
  // The source answers again: it is no longer failing.
  {
    name: 'removes it at a success',
    sourceBefore: buildStaleEnduroSimulator(),
    poll: buildGoodSessionPoll(),
    expectedFailingSinceMs: undefined,
  },
  // Failing from the very first poll: it has been failing since then.
  {
    name: 'sets it at the failure of a source that never had a good poll',
    sourceBefore: buildSimulatorThatNeverHadAGoodPoll(),
    poll: buildFailedPoll('Tempo esgotado: a fonte não respondeu em 2 s.'),
    expectedFailingSinceMs: momentOfThePollMs,
  },
  // The poller's stale watch reports a hung poll as a failure like any other.
  {
    name: 'sets it at the stale watch\'s "Sem dados novos" failure',
    sourceBefore: buildHealthyEnduroSimulator(),
    poll: buildFailedPoll('Sem dados novos há 6 s.'),
    expectedFailingSinceMs: momentOfThePollMs,
  },
  // A payload that fails its shape is a failed poll, so it starts the failing too.
  {
    name: 'sets it at a payload that fails its shape',
    sourceBefore: buildHealthyEnduroSimulator(),
    poll: buildPollWithAnInvalidPayload(),
    expectedFailingSinceMs: momentOfThePollMs,
  },
];

describe('recordDataSourcePoll, when the source started failing', () => {
  it.each(failingSinceScenarios)('$name', ({ sourceBefore, poll, expectedFailingSinceMs }) => {
    // Arrange: this row's source, with data of eight seconds ago.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [sourceBefore],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs - 8_000)],
    });

    // Act: record this row's poll.
    const outcome = reduceDataSourceCommand(slicesBefore, poll, contextOfTheDataSourceCommand);

    // Assert: failingSinceMs is the moment the row expects, or absent.
    const statusAfter =
      outcome.status === 'applied' ? outcome.slices.dataSources[0]?.status : undefined;
    expect(statusAfter, 'every poll of an enabled source is applied').toBeDefined();
    expect(
      statusAfter?.failingSinceMs,
      'failingSinceMs must mark when the failing started, and only while it lasts',
    ).toBe(expectedFailingSinceMs);
    expect(
      statusAfter !== undefined && 'failingSinceMs' in statusAfter,
      'a source that is not failing must carry no failingSinceMs at all',
    ).toBe(expectedFailingSinceMs !== undefined);
  });

  it('still hands back the very same slices when a healthy source repeats its stored shapes', () => {
    // Arrange: the simulator healthy, its stored snapshot made at the moment of the poll.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfThePollMs)],
    });

    // Act: a new poll answers exactly the same session.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      buildGoodSessionPoll(),
      contextOfTheDataSourceCommand,
    );

    // Assert: the very same slices object, not an equal copy: the store saves, logs and
    // broadcasts nothing only when it gets the same reference back (D7).
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(outcome.status, 'a repeat on a healthy source is still applied').toBe('applied');
    expect(slicesAfter, 'a repeat must hand back the very same slices object').toBe(slicesBefore);
    expect(
      slicesAfter?.dataSources,
      'a repeat must not rebuild the sources (and with them the status)',
    ).toBe(slicesBefore.dataSources);
  });
});
