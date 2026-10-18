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
 *   - A source that already has data still starts its recording at no snapshot: the
 *     recorder writes that data as the first line and only then counts it (gate 2).
 *   - A recording started in the same millisecond as an earlier one of the same source
 *     (start, stop, start) gets its own file name, so it never appends to the earlier
 *     file (gate 2 on PR #16).
 *   - A second start of a source already recording is an accepted no-op.
 *   - A source that is off is refused with DATA_SOURCE_DISABLED.
 *
 * What these tests deliberately do not cover:
 *   - Counting the snapshots of a recording; recordRecordingProgress.test.ts covers it.
 *   - Writing the file; recorder.test.ts covers it.
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

  it('starts at no snapshot even when the source already has data', () => {
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

    // Assert: no snapshot counted yet. The recorder writes the data on screen as the
    // first line and reports it once it is in the file.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.recordings.map((recording) => recording.snapshotCount),
      'a snapshot is counted only once it is written',
    ).toEqual([0]);
  });

  const sameMillisecondScenarios = [
    // Start, stop and start again within one millisecond (two tablets, a fast script):
    // the second recording must not append to the first one's file.
    {
      name: 'names a second recording of the same millisecond apart from the first',
      earlierFileNames: ['2027-08-14T14-32-05.000Z.jsonl'],
      expectedFileName: '2027-08-14T14-32-05.000Z-2.jsonl',
    },
    // A third one in that millisecond takes the next free number.
    {
      name: 'names a third recording of the same millisecond with the next number',
      earlierFileNames: ['2027-08-14T14-32-05.000Z.jsonl', '2027-08-14T14-32-05.000Z-2.jsonl'],
      expectedFileName: '2027-08-14T14-32-05.000Z-3.jsonl',
    },
  ];

  it.each(sameMillisecondScenarios)('$name', ({ earlierFileNames, expectedFileName }) => {
    // Arrange: the simulator on, with this row's recordings already closed at 14:32:05.
    const earlierRecordings = earlierFileNames.map((fileName) => ({
      ...buildFridayRecording(),
      id: `simulador-enduro/${fileName}`,
      fileName,
      startedAtMs: momentOfTheCommandMs,
      endedAtMs: momentOfTheCommandMs,
      snapshotCount: 0,
    }));
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      recordings: earlierRecordings,
    });

    // Act: press "Gravar" again, still at 14:32:05.000.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'startRecording', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: the new recording has a file name, and an id, of its own.
    const newRecording =
      outcome.status === 'applied' ? outcome.slices.recordings.at(-1) : undefined;
    expect(
      [newRecording?.fileName, newRecording?.id],
      'two recordings must never share a file',
    ).toEqual([expectedFileName, `simulador-enduro/${expectedFileName}`]);
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
