/**
 * The recorder's count of the lines it wrote: the recordRecordingProgress reducer
 * (apps/server)
 *
 * What this module is for:
 *   A recording's snapshotCount must say how many snapshots really reached the file, so
 *   it goes up only after a write succeeded (gate 2 on PR #16). The recorder, which does
 *   the writing, reports the number of lines it has written with recordRecordingProgress
 *   (signed `sistema:gravador`), and this reducer copies that number into the
 *   `recordings` slice. A report arrives every couple of seconds per recording, so it is
 *   left out of the event log like a routine poll.
 *
 * What these tests prove:
 *   - The count of an open recording becomes the reported number; other recordings are
 *     untouched; the outcome is left out of the event log.
 *   - A report that lands just after "Parar gravação" still counts the line it reports,
 *     because that line is in the file.
 *   - A report of the number already shown, or of a recording the list does not hold,
 *     hands back the very same slices.
 *
 * What these tests deliberately do not cover:
 *   - The recorder sending the report after each write; recorder.test.ts covers it.
 *   - Who may send this command; authorizeDataSourceCommands.test.ts in core/store.
 */
import { describe, expect, it } from 'vitest';

import {
  buildFridayRecording,
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  buildRecordingOpenSince1430,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

/** The id of today's recording, open since 14:30. */
const todaysRecordingId = 'simulador-enduro/2027-08-14T14-30-00.000Z.jsonl';

describe('recordRecordingProgress', () => {
  it('sets the count of the recording to the number of lines written, out of the event log', () => {
    // Arrange: the simulator recording since 14:30, 62 lines counted; Friday's listed too.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildHealthyEnduroSimulator(), isRecording: true }],
      recordings: [buildFridayRecording(), buildRecordingOpenSince1430(62)],
    });

    // Act: the recorder reports that 63 lines are now in the file.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'recordRecordingProgress', recordingId: todaysRecordingId, snapshotCount: 63 },
      contextOfTheDataSourceCommand,
    );

    // Assert: today's recording shows 63, Friday's is untouched, and no event-log row.
    expect(outcome, 'the count must follow the lines written, with no event-log row').toEqual({
      status: 'applied',
      slices: {
        ...slicesBefore,
        recordings: [buildFridayRecording(), buildRecordingOpenSince1430(63)],
      },
      isLeftOutOfTheEventLog: true,
    });
  });

  it('counts a line reported just after "Parar gravação"', () => {
    // Arrange: today's recording closed a moment ago, at 62 lines counted.
    const closedRecording = { ...buildRecordingOpenSince1430(62), endedAtMs: momentOfTheCommandMs };
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      recordings: [closedRecording],
    });

    // Act: the report of the 63rd line, written before the stop, lands after it.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'recordRecordingProgress', recordingId: todaysRecordingId, snapshotCount: 63 },
      contextOfTheDataSourceCommand,
    );

    // Assert: the closed recording counts 63, because that line is in its file.
    const recordingsAfter = outcome.status === 'applied' ? outcome.slices.recordings : [];
    expect(recordingsAfter, 'a line in the file must be counted, even after the stop').toEqual([
      { ...closedRecording, snapshotCount: 63 },
    ]);
  });

  const unchangedScenarios = [
    // Two reports with the same number (two timers that both fired): nothing to send.
    {
      name: 'changes nothing when the count is already the reported one',
      recordingId: todaysRecordingId,
      snapshotCount: 62,
    },
    // A recording the list does not hold (a file deleted by hand before a restart):
    // there is nothing to count it in, and nothing to refuse either.
    {
      name: 'changes nothing for a recording the list does not hold',
      recordingId: 'simulador-enduro/2027-08-14T09-00-00.000Z.jsonl',
      snapshotCount: 5,
    },
  ];

  it.each(unchangedScenarios)('$name', ({ recordingId, snapshotCount }) => {
    // Arrange: the simulator recording since 14:30, 62 lines counted.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildHealthyEnduroSimulator(), isRecording: true }],
      recordings: [buildRecordingOpenSince1430(62)],
    });

    // Act: the recorder's report of this row.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'recordRecordingProgress', recordingId, snapshotCount },
      contextOfTheDataSourceCommand,
    );

    // Assert: the very same slices, so nothing is saved or broadcast.
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'a report that changes no count must hand back the same slices',
    ).toBe(slicesBefore);
  });
});
