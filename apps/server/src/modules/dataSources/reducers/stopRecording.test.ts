/**
 * "Parar gravação": the stopRecording reducer (apps/server)
 *
 * What this module is for:
 *   Recording is bookkeeping in state (decision D10): stopRecording closes the source's
 *   open entry in the `recordings` slice. The operator sends it from the button; the
 *   recorder sends it, as `sistema:gravador` with a pt-BR failure message, after a write
 *   to the file failed (decision D9).
 *
 * What these tests prove:
 *   - The open recording is closed at the moment of the command and the source is no
 *     longer recording.
 *   - The recorder's failure message is shown on the source; the source stays on.
 *   - A stop of a source that is not recording changes nothing.
 *   - An unknown source is refused for the operator, but the recorder's late stop of a
 *     source deleted a moment ago is an accepted no-op (no refusal row).
 *
 * What these tests deliberately do not cover:
 *   - Who may send the command; authorizeDataSourceCommands.test.ts in core/store.
 *   - The recorder noticing the failed write; recorder.test.ts covers it (commit 5).
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

/** The pt-BR reason the recorder sends when it could not write the file. */
const failedWriteMessage = 'A gravação parou: não foi possível escrever no disco.';

describe('stopRecording', () => {
  it('closes the open recording at that moment', () => {
    // Arrange: the simulator recording since 14:30.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildHealthyEnduroSimulator(), isRecording: true }],
      recordings: [buildRecordingOpenSince1430()],
    });

    // Act: press "Parar gravação".
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'stopRecording', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: closed now; the source no longer recording, with no error.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.recordings, 'the recording must end at that moment').toEqual([
      { ...buildRecordingOpenSince1430(), endedAtMs: momentOfTheCommandMs },
    ]);
    expect(
      slicesAfter?.dataSources[0]?.isRecording,
      'a stopped source must no longer be recording',
    ).toBe(false);
    expect(
      slicesAfter?.dataSources[0]?.status.recordingError,
      'a plain stop must leave no recording error',
    ).toBe(null);
  });

  it("shows the recorder's reason on the source when it stops a recording it could not write", () => {
    // Arrange: the simulator recording since 14:30.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildHealthyEnduroSimulator(), isRecording: true }],
      recordings: [buildRecordingOpenSince1430()],
    });

    // Act: the recorder stops it after a write failed.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'stopRecording', sourceId: 'simulador-enduro', failureMessage: failedWriteMessage },
      contextOfTheDataSourceCommand,
    );

    // Assert: the reason is on the source; it keeps polling (still on).
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    expect(sourceAfter?.status.recordingError, 'the operator must read why it stopped').toBe(
      failedWriteMessage,
    );
    expect(sourceAfter?.isEnabled, 'a recording failure never turns the source off').toBe(true);
  });

  it('changes nothing when the source is not recording', () => {
    // Arrange: the simulator on, not recording.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      recordings: [buildSaturdayRecording()],
    });

    // Act: press "Parar gravação" from a page that had not caught up.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'stopRecording', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: the same slices.
    expect(outcome, 'stopping nothing must change nothing').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
  });

  it('refuses the operator a stop of a source that does not exist', () => {
    // Arrange: the seeded simulator only.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: press "Parar gravação" on a source deleted on another tablet.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'stopRecording', sourceId: 'planilha-apagada' },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused, so the operator's page says the source is gone.
    expect(
      outcome.status === 'refused' ? outcome.error.code : undefined,
      'a source that does not exist must be refused with DATA_SOURCE_NOT_FOUND',
    ).toBe('DATA_SOURCE_NOT_FOUND');
  });

  it("leaves no trace when the recorder's stop arrives after the source was deleted", () => {
    // Arrange: the simulator was deleted while recording; Saturday's recording remains.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [],
      recordings: [buildSaturdayRecording()],
    });

    // Act: the recorder's stop, sent from its 0 ms timer, arrives after the delete.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'stopRecording', sourceId: 'simulador-enduro', failureMessage: failedWriteMessage },
      contextOfTheDataSourceCommand,
    );

    // Assert: accepted with the same slices, so no refusal row signed by the system.
    expect(outcome, 'a late stop from the recorder must change nothing and not be refused').toEqual(
      { status: 'applied', slices: slicesBefore },
    );
  });
});
