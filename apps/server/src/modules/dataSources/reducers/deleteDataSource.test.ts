/**
 * Deleting a data source: the deleteDataSource reducer (apps/server)
 *
 * What this module is for:
 *   "Excluir" on a row of the "Fontes" page, confirmed. The source goes, and its last
 *   data with it; its recordings are files the operator made on purpose, so they stay
 *   listed (and on disk) and can still be replayed after the source is gone.
 *
 * What these tests prove:
 *   - The source and its snapshot are removed; the recordings list is untouched.
 *   - A source deleted while recording has its recording closed at that moment.
 *   - An unknown source is refused with DATA_SOURCE_NOT_FOUND.
 *
 * What these tests deliberately do not cover:
 *   - The poller stopping its loop on delete; pollerLifecycle.test.ts covers it.
 *   - A late poll of the deleted source; recordDataSourcePoll.test.ts covers it.
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

describe('deleteDataSource', () => {
  it('removes the source and its snapshot and keeps its recordings listed', () => {
    // Arrange: the simulator on, with a snapshot and Friday's recording.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      dataSnapshots: [buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs - 2_000)],
      recordings: [buildFridayRecording()],
    });

    // Act: delete it.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'deleteDataSource', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: no source, no snapshot, the recording still there to replay.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.dataSources, 'the source must be gone').toEqual([]);
    expect(slicesAfter?.dataSnapshots, 'its snapshot must be gone with it').toEqual([]);
    expect(slicesAfter?.recordings, 'its recordings stay replayable').toBe(slicesBefore.recordings);
  });

  it('closes the recording of a source deleted while recording', () => {
    // Arrange: the simulator recording since 14:30.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [{ ...buildHealthyEnduroSimulator(), isRecording: true }],
      recordings: [buildRecordingOpenSince1430()],
    });

    // Act: delete it.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'deleteDataSource', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: the recording ends at the moment of the delete.
    const recordingsAfter = outcome.status === 'applied' ? outcome.slices.recordings : [];
    expect(recordingsAfter, 'deleting must close the recording at that moment').toEqual([
      { ...buildRecordingOpenSince1430(), endedAtMs: momentOfTheCommandMs },
    ]);
  });

  it('refuses an unknown source', () => {
    // Arrange: the seeded simulator only.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: delete a source that is not there.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'deleteDataSource', sourceId: 'planilha-apagada' },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused with DATA_SOURCE_NOT_FOUND.
    expect(
      outcome.status === 'refused' ? outcome.error.code : undefined,
      'a source that does not exist must be refused with DATA_SOURCE_NOT_FOUND',
    ).toBe('DATA_SOURCE_NOT_FOUND');
  });
});
