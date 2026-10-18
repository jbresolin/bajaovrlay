/**
 * Turning a data source on and off: the setDataSourceEnabled reducer (apps/server)
 *
 * What this module is for:
 *   The switch on each row of the "Fontes" page. Turning a source on starts its
 *   timeline (decision D5): a simulator's race starts now only if it never started, so
 *   it carries on where wall time puts it; a replay always starts again from the top,
 *   because every rehearsal starts from the beginning. Turning it off stops its
 *   recording and leaves its last good data in place.
 *
 * What these tests prove:
 *   - On: the simulator's race start is set to now when missing and kept when present;
 *     the replay's start is set to now every time.
 *   - On: a source with a snapshot from before is stale until its next good poll; one
 *     with no snapshot is not; the error, the failure count and failingSinceMs start
 *     again.
 *   - Off: not stale and not failing (a source that is off is off, not late), the
 *     snapshot kept, an open recording closed at that moment.
 *   - Sending the state the source already has hands back the same slices; an unknown
 *     source is refused with DATA_SOURCE_NOT_FOUND.
 *
 * What these tests deliberately do not cover:
 *   - The poller starting and stopping its loop; pollerLifecycle.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSimulatorTurnedOff,
  buildFridayRecording,
  buildFridayReplayTurnedOff,
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  buildRecordingOpenSince1430,
  buildSimulatorSnapshotReceivedAt,
  buildStaleEnduroSimulator,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

describe('setDataSourceEnabled, turning a source on', () => {
  const timelineScenarios = [
    // The seeded simulator was never on: its race starts now.
    {
      name: "starts the simulator's race now when it never started",
      sourceBefore: buildEnduroSimulatorTurnedOff(),
      expectedConfig: {
        ...buildEnduroSimulatorTurnedOff().config,
        simulatedStartAtMs: momentOfTheCommandMs,
      },
    },
    // Turned off at 14:20 and on again: the race carries on from 14:00, as wall time says.
    {
      name: "keeps the simulator's race start when it has one",
      sourceBefore: { ...buildHealthyEnduroSimulator(), isEnabled: false },
      expectedConfig: buildHealthyEnduroSimulator().config,
    },
    // A replay rehearses from the top every time it is turned on.
    {
      name: 'starts the replay again from now, every time',
      sourceBefore: {
        ...buildFridayReplayTurnedOff(),
        config: {
          ...buildFridayReplayTurnedOff().config,
          replayStartedAtMs: Date.parse('2027-08-14T09:00:00.000Z'),
        },
      },
      expectedConfig: {
        ...buildFridayReplayTurnedOff().config,
        replayStartedAtMs: momentOfTheCommandMs,
      },
    },
  ];

  it.each(timelineScenarios)('$name', ({ sourceBefore, expectedConfig }) => {
    // Arrange: the source of this row, off.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [sourceBefore],
      recordings: [buildFridayRecording()],
    });

    // Act: turn it on.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'setDataSourceEnabled', sourceId: sourceBefore.id, isEnabled: true },
      contextOfTheDataSourceCommand,
    );

    // Assert: on, with the timeline start of this row.
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    expect(sourceAfter?.isEnabled, 'the source must be on').toBe(true);
    expect(sourceAfter?.config, 'the timeline must start as decision D5 says').toEqual(
      expectedConfig,
    );
  });

  it('marks the old snapshot stale until the next good poll, and forgets the old failing', () => {
    // Arrange: the simulator turned off while it was failing, its last data kept.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildStaleEnduroSimulator(), isEnabled: false }],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs - 600_000)],
    });

    // Act: turn it on again.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
      contextOfTheDataSourceCommand,
    );

    // Assert: stale (its data is ten minutes old), no error, no failure counted yet.
    const statusAfter =
      outcome.status === 'applied' ? outcome.slices.dataSources[0]?.status : undefined;
    expect(statusAfter?.isStale, 'data from before must read as late').toBe(true);
    expect(statusAfter?.lastError, 'the old error must not be shown again').toBeNull();
    expect(statusAfter?.consecutiveFailures, 'failures count from the new start').toBe(0);
    expect(
      statusAfter !== undefined && 'failingSinceMs' in statusAfter,
      'a source turned on again is not failing until a poll fails',
    ).toBe(false);
  });

  it('does not mark a source with no data at all as stale', () => {
    // Arrange: the seeded simulator, never polled.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: turn it on.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
      contextOfTheDataSourceCommand,
    );

    // Assert: not stale: there is no old data to be late.
    const statusAfter =
      outcome.status === 'applied' ? outcome.slices.dataSources[0]?.status : undefined;
    expect(statusAfter?.isStale, 'nothing old to warn about').toBe(false);
  });
});

describe('setDataSourceEnabled, turning a source off', () => {
  it('clears stale and the failing moment, keeps the snapshot and closes the open recording', () => {
    // Arrange: the simulator failing, recording since 14:30, with its last good data.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildStaleEnduroSimulator(), isRecording: true }],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs - 8_000)],
      recordings: [buildFridayRecording(), buildRecordingOpenSince1430()],
    });

    // Act: turn it off.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: false },
      contextOfTheDataSourceCommand,
    );

    // Assert: off, not stale, not recording; the snapshot kept; the recording closed now.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    const sourceAfter = slicesAfter?.dataSources[0];
    expect(sourceAfter?.isEnabled, 'the source must be off').toBe(false);
    expect(sourceAfter?.status.isStale, 'a source that is off is off, not late').toBe(false);
    expect(
      sourceAfter !== undefined && 'failingSinceMs' in sourceAfter.status,
      'a source that is off is not failing, so it carries no failingSinceMs',
    ).toBe(false);
    expect(sourceAfter?.isRecording, 'turning off stops the recording').toBe(false);
    expect(slicesAfter?.dataSnapshots, 'the last good data stays (rule 4)').toBe(
      slicesBefore.dataSnapshots,
    );
    expect(slicesAfter?.recordings, 'the open recording ends at that moment').toEqual([
      buildFridayRecording(),
      { ...buildRecordingOpenSince1430(), endedAtMs: momentOfTheCommandMs },
    ]);
  });
});

describe('setDataSourceEnabled, edge cases', () => {
  it('hands back the very same slices when the source is already in that state', () => {
    // Arrange: the seeded simulator, off.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: turn it off again (two tablets pressing the switch at once).
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: false },
      contextOfTheDataSourceCommand,
    );

    // Assert: the same slices.
    expect(outcome, 'a switch to the state it has must change nothing').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
  });

  it('refuses an unknown source', () => {
    // Arrange: the seeded simulator only.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: turn on a source that was deleted.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'setDataSourceEnabled', sourceId: 'planilha-apagada', isEnabled: true },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused with DATA_SOURCE_NOT_FOUND.
    expect(
      outcome.status === 'refused' ? outcome.error.code : undefined,
      'a source that does not exist must be refused with DATA_SOURCE_NOT_FOUND',
    ).toBe('DATA_SOURCE_NOT_FOUND');
  });
});
