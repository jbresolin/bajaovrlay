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
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  buildRecordingOpenSince1430,
  buildSaturdayRecording,
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
      recordings: [buildSaturdayRecording()],
    });

    // Act: press "Gravar" at 14:32:05.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'startRecording', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: a new open recording after Saturday's; the source recording, error cleared.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.recordings, 'a new open recording must be listed').toEqual([
      buildSaturdayRecording(),
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
