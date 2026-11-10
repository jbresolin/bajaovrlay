import {
  areJsonValuesEqual,
  type DataSnapshot,
  type DataSnapshotShapes,
  type DataSource,
  type RecordDataSourcePollCommand,
  type YouTubeQuotaUsage,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { isSourceHealthy, removeFailingSinceFromStatus } from '../dataSourceHealth.js';
import { findDataSource, replaceDataSource } from '../dataSourceListing.js';
import { validatePolledShapes } from '../polledShapesValidation.js';

/**
 * recordDataSourcePoll (sent only by the source's poller): records one poll.
 * - A source deleted or turned off a moment ago: nothing changes and nothing is refused,
 *   because the poller can lose that race and must not fill the log with refusals (D8,
 *   like a late reportInstanceStatus).
 * - A good poll whose shapes all validate: the new snapshot, and a healthy status with
 *   no failingSinceMs. The recording's count is not touched: the recorder reports it
 *   once the line is in the file (recordRecordingProgress, gate 2 on PR #16).
 * - A failed poll, or a good one with a bad shape or no shape at all (a poll never
 *   half-succeeds): the last good snapshot and lastOkAtMs stay (rule 4), the source is
 *   stale, the error is kept (a pt-BR fallback when the adapter gave none) and the
 *   failure counted. The first failure sets failingSinceMs to its moment and later ones
 *   keep it, so the page's minute to red "Erro" counts from when the failing started
 *   (João's gate 2 re-check on PR #16).
 * - A good poll that repeats the stored shapes on a healthy source changes nothing: the
 *   same slices come back, so nothing is saved, logged or broadcast (D7). Its timestamps
 *   are therefore not written either: the poller judges freshness by time from its own
 *   memory of the last good poll, never from lastOkAtMs, so a quiet source never looks late.
 * - A YouTube source's poll carries the key's quota spent today (BAJAOVRLAY-35), kept on
 *   the status good or failed; a repeat whose quota moved changes the status only.
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
  const sourceWithItsQuota = keepTheQuotaOnTheStatus(source, pollResult.youTubeQuota);
  if (!pollResult.ok) {
    // An adapter that threw an Error with no message still fails the poll; the operator
    // reads a sentence instead of an empty tooltip.
    const isReasonMissing = pollResult.error === '';
    const error = isReasonMissing
      ? ptBR.dataSourceErrors.failedPollWithoutReason
      : pollResult.error;
    return recordFailedPoll(slices, sourceWithItsQuota, error, pollResult.attemptedAtMs);
  }
  const shapesValidation = validatePolledShapes(pollResult.shapes);
  if (!shapesValidation.isValid) {
    return recordFailedPoll(
      slices,
      sourceWithItsQuota,
      shapesValidation.errorMessage,
      pollResult.receivedAtMs,
    );
  }
  return recordGoodPoll(
    slices,
    sourceWithItsQuota,
    shapesValidation.shapes,
    pollResult.receivedAtMs,
  );
}

/**
 * The source with the poll's quota on its status, or the source itself when the poll
 * carried none (every kind but YouTube) or the same one: an unchanged source stays the
 * same object, so a repeat poll is still a no-op.
 */
function keepTheQuotaOnTheStatus(
  source: DataSource,
  youTubeQuota: YouTubeQuotaUsage | undefined,
): DataSource {
  if (youTubeQuota === undefined || areJsonValuesEqual(source.status.youTubeQuota, youTubeQuota)) {
    return source;
  }
  return { ...source, status: { ...source.status, youTubeQuota } };
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
    const storedSource = findDataSource(slices.dataSources, source.id);
    if (storedSource === source) {
      return { status: 'applied', slices };
    }
    // The same Super Chats, a new count of quota units: the status only, never logged.
    return {
      status: 'applied',
      slices: { ...slices, dataSources: replaceDataSource(slices.dataSources, source) },
      isLeftOutOfTheEventLog: true,
    };
  }

  const newSnapshot: DataSnapshot = { sourceId: source.id, receivedAtMs, shapes };
  const dataSnapshots =
    storedSnapshot === undefined
      ? [...slices.dataSnapshots, newSnapshot]
      : slices.dataSnapshots.map((snapshot) =>
          snapshot.sourceId === source.id ? newSnapshot : snapshot,
        );
  const healthyStatus = removeFailingSinceFromStatus({
    ...source.status,
    lastAttemptAtMs: receivedAtMs,
    lastOkAtMs: receivedAtMs,
    lastError: null,
    consecutiveFailures: 0,
    isStale: false,
  });
  const healthySource: DataSource = { ...source, status: healthyStatus };
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
  // Kept from the first failure on; set now when this is the first one.
  const failingSinceMs = source.status.failingSinceMs ?? attemptedAtMs;
  const staleSource: DataSource = {
    ...source,
    status: {
      ...source.status,
      lastAttemptAtMs: attemptedAtMs,
      lastError: error,
      consecutiveFailures: source.status.consecutiveFailures + 1,
      isStale: true,
      failingSinceMs,
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
