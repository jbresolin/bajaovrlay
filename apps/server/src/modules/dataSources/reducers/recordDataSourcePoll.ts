import type {
  DataSnapshot,
  DataSnapshotShapes,
  DataSource,
  RecordDataSourcePollCommand,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { areJsonValuesEqual } from '../areJsonValuesEqual.js';
import { isSourceHealthy } from '../dataSourceHealth.js';
import { findDataSource, replaceDataSource } from '../dataSourceListing.js';
import { validatePolledShapes } from '../polledShapesValidation.js';

/**
 * recordDataSourcePoll (sent only by the source's poller): records one poll.
 * - A source deleted or turned off a moment ago: nothing changes and nothing is refused,
 *   because the poller can lose that race and must not fill the log with refusals (D8,
 *   like a late reportInstanceStatus).
 * - A good poll whose shapes all validate: the new snapshot, and a healthy status. The
 *   recording's count is not touched: the recorder reports it once the line is in the
 *   file (recordRecordingProgress, gate 2 on PR #16).
 * - A failed poll, or a good one with a bad shape or no shape at all (a poll never
 *   half-succeeds): the last good snapshot and lastOkAtMs stay (rule 4), the source is
 *   stale, the error is kept (a pt-BR fallback when the adapter gave none) and the
 *   failure counted.
 * - A good poll that repeats the stored shapes on a healthy source changes nothing: the
 *   same slices come back, so nothing is saved, logged or broadcast (D7). Its timestamps
 *   are therefore not written either: the poller judges freshness by time from its own
 *   memory of the last good poll, never from lastOkAtMs, so a quiet source never looks late.
 * The outcome is left out of the event log when the source's health did not change (D11).
 */
export function reduceRecordDataSourcePoll(
  slices: SlicesChangedByCommands,
  command: RecordDataSourcePollCommand,
): ReducerOutcome {
  const source = findDataSource(slices.dataSources, command.sourceId);
  if (source === undefined || !source.isEnabled) {
    return { status: 'applied', slices };
  }

  const pollResult = command.result;
  if (!pollResult.ok) {
    // An adapter that threw an Error with no message still fails the poll; the operator
    // reads a sentence instead of an empty tooltip.
    const isReasonMissing = pollResult.error === '';
    const error = isReasonMissing
      ? ptBR.dataSourceErrors.failedPollWithoutReason
      : pollResult.error;
    return recordFailedPoll(slices, source, error, pollResult.attemptedAtMs);
  }
  const shapesValidation = validatePolledShapes(pollResult.shapes);
  if (!shapesValidation.isValid) {
    return recordFailedPoll(slices, source, shapesValidation.errorMessage, pollResult.receivedAtMs);
  }
  return recordGoodPoll(slices, source, shapesValidation.shapes, pollResult.receivedAtMs);
}

/** The outcome of a good poll with valid shapes; see reduceRecordDataSourcePoll. */
function recordGoodPoll(
  slices: SlicesChangedByCommands,
  source: DataSource,
  shapes: DataSnapshotShapes,
  receivedAtMs: number,
): ReducerOutcome {
  const storedSnapshot = slices.dataSnapshots.find((snapshot) => snapshot.sourceId === source.id);
  const isRepeatOnAHealthySource =
    storedSnapshot !== undefined &&
    isSourceHealthy(source.status) &&
    areJsonValuesEqual(storedSnapshot.shapes, shapes);
  if (isRepeatOnAHealthySource) {
    return { status: 'applied', slices };
  }

  const newSnapshot: DataSnapshot = { sourceId: source.id, receivedAtMs, shapes };
  const dataSnapshots =
    storedSnapshot === undefined
      ? [...slices.dataSnapshots, newSnapshot]
      : slices.dataSnapshots.map((snapshot) =>
          snapshot.sourceId === source.id ? newSnapshot : snapshot,
        );
  const healthySource: DataSource = {
    ...source,
    status: {
      ...source.status,
      lastAttemptAtMs: receivedAtMs,
      lastOkAtMs: receivedAtMs,
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
    },
  };
  const nextSlices = {
    ...slices,
    dataSources: replaceDataSource(slices.dataSources, healthySource),
    dataSnapshots,
  };
  return buildPollOutcome(nextSlices, source, healthySource);
}

/** The outcome of a failed poll (or a bad payload); see reduceRecordDataSourcePoll. */
function recordFailedPoll(
  slices: SlicesChangedByCommands,
  source: DataSource,
  error: string,
  attemptedAtMs: number,
): ReducerOutcome {
  const staleSource: DataSource = {
    ...source,
    status: {
      ...source.status,
      lastAttemptAtMs: attemptedAtMs,
      lastError: error,
      consecutiveFailures: source.status.consecutiveFailures + 1,
      isStale: true,
    },
  };
  const nextSlices = { ...slices, dataSources: replaceDataSource(slices.dataSources, staleSource) };
  return buildPollOutcome(nextSlices, source, staleSource);
}

/**
 * Wraps the slices of a poll in an applied outcome, left out of the event log when the
 * source's health is as it was: stale before and after alike, and the same error text.
 * So a row is written when a source goes stale, recovers, or fails for a new reason (an
 * invalid payload is logged the first time it appears, not every two seconds), and never
 * for the routine poll (decision D11).
 */
function buildPollOutcome(
  nextSlices: SlicesChangedByCommands,
  sourceBefore: DataSource,
  sourceAfter: DataSource,
): ReducerOutcome {
  const isStaleUnchanged = sourceBefore.status.isStale === sourceAfter.status.isStale;
  const isErrorUnchanged = sourceBefore.status.lastError === sourceAfter.status.lastError;
  if (isStaleUnchanged && isErrorUnchanged) {
    return { status: 'applied', slices: nextSlices, isLeftOutOfTheEventLog: true };
  }
  return { status: 'applied', slices: nextSlices };
}
