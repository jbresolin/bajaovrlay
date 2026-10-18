/**
 * "Gravar": the startRecording reducer (apps/server)
 *
 * What this module is for:
 *   Recording is bookkeeping in state (decision D10): startRecording opens an entry in the
 *   `recordings` slice and marks the source recording; the recorder only mirrors that to
 *   disk.
 *
 * What these tests prove:
 *   - The new recording is named after its moment (':' made '-', D10), carries the
 *     source's label and starts empty; the source is marked recording and a past
 *     recording error is cleared.
 *   - A source that already has data starts its recording with that one snapshot
 *     counted (the recorder writes it as the first line).
 *   - A second start of a source already recording is an accepted no-op.
 *   - A source that is off is refused with DATA_SOURCE_DISABLED.
 *
 * What these tests deliberately do not cover:
 *   - Counting the snapshots of a recording; recordDataSourcePoll.test.ts covers it.
 *   - Writing the file; recorder.test.ts covers it (commit 5).
 */
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSimulatorTurnedOff,
  buildFridayRecording,
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  buildRecordingOpenSince1430,
  buildSimulatorSnapshotReceivedAt,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

describe('startRecording', () => {
  it('opens a recording named after its moment and marks the source recording', () => {
    // Arrange: the simulator on, whose last recording failed to write.
    const simulatorWithRecordingError = {
      ...buildHealthyEnduroSimulator(),
      status: { ...buildHealthyEnduroSimulator().status, recordingError: 'Disco cheio.' },
    };
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [simulatorWithRecordingError],
      recordings: [buildFridayRecording()],
    });

    // Act: press "Gravar" at 14:32:05.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'startRecording', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: a new open recording after Friday's; the source recording, error cleared.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.recordings, 'a new open recording must be listed').toEqual([
      buildFridayRecording(),
      {
        id: 'simulador-enduro/2027-08-14T14-32-05.000Z.jsonl',
        sourceId: 'simulador-enduro',
        sourceLabel: 'Simulador — Enduro',
        fileName: '2027-08-14T14-32-05.000Z.jsonl',
        startedAtMs: momentOfTheCommandMs,
        endedAtMs: null,
        snapshotCount: 0,
      },
    ]);
    expect(slicesAfter?.dataSources[0]?.isRecording, 'the source must be recording').toBe(true);
    expect(
      slicesAfter?.dataSources[0]?.status.recordingError,
      'a new recording starts with no error',
    ).toBeNull();
  });

  it('counts the data the source already has as the first snapshot of the recording', () => {
    // Arrange: the simulator on, with the data of its poll at 14:32:04.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs - 1_000)],
    });

    // Act: press "Gravar" at 14:32:05.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'startRecording', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: the new recording holds one snapshot, the line the recorder writes at once.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.recordings.map((recording) => recording.snapshotCount),
      'the data on screen when "Gravar" is pressed is the first line, so it must be counted',
    ).toEqual([1]);
  });

  it('changes nothing when the source is already recording', () => {
    // Arrange: the simulator recording since 14:30.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildHealthyEnduroSimulator(), isRecording: true }],
      recordings: [buildRecordingOpenSince1430()],
    });

    // Act: press "Gravar" again from a second tablet.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'startRecording', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: the same slices; the recording goes on.
    expect(outcome, 'a second start must change nothing').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
  });

  it('refuses a source that is off', () => {
    // Arrange: the seeded simulator, off.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: press "Gravar".
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'startRecording', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused with DATA_SOURCE_DISABLED: nothing would ever be written.
    expect(
      outcome.status === 'refused' ? outcome.error.code : undefined,
      'a source that is off must be refused with DATA_SOURCE_DISABLED: nothing would ever be written',
    ).toBe('DATA_SOURCE_DISABLED');
  });
});
