// One poll's answer, from the adapter to the store: asking the adapter of the source's
// kind, turning its answer (or its silence) into a poll result, and handing that result
// to the store with the log lines that go with it. The loops that decide when to poll
// live in poller.ts.
import type { DataSource, RecordDataSourcePollCommand } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { ptBR } from '../../core/messages/ptBR.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  type DataSourceAdapters,
  pollDataSourceWithTheAdapterOfItsKind,
} from './adapters/createDataSourceAdapters.js';
import { StillPreparingForPollingError } from './adapters/dataSourceAdapter.js';

/** The result of one poll, exactly as recordDataSourcePoll carries it. */
export type PollResult = RecordDataSourcePollCommand['result'];

/** What one poll of one source needs. */
export type PollTheSourceOptions = {
  source: DataSource;
  adapters: DataSourceAdapters;
  readCurrentTime: () => Date;
  /** Fires when the poll is called off (timeout, source turned off, server closing). */
  signal: AbortSignal;
  /** Only used to word the "Tempo esgotado" error. */
  timeoutInMilliseconds: number;
};

/**
 * Asks the adapter of the source's kind for its shapes and turns the answer into a
 * poll result. A poll is dated when it started. A signalled poll is a timeout, even
 * when the adapter answered anyway after the signal, except when the adapter rejected
 * with StillPreparingForPollingError: its message ("Carregando a gravação…") is recorded,
 * because the operator should read that the source is getting ready, not that it is slow.
 */
export async function pollTheSourceIntoAPollResult(
  options: PollTheSourceOptions,
): Promise<PollResult> {
  const { source, adapters, readCurrentTime, signal, timeoutInMilliseconds } = options;
  const attemptedAtMs = readCurrentTime().getTime();
  const timeoutFailure: PollResult = {
    ok: false,
    error: ptBR.dataSourceErrors.pollTimedOut(timeoutInMilliseconds / 1_000),
    attemptedAtMs,
  };
  try {
    const polledShapes = await pollDataSourceWithTheAdapterOfItsKind(source, adapters, {
      readCurrentTime,
      signal,
    });
    if (signal.aborted) {
      return timeoutFailure;
    }
    return { ok: true, shapes: polledShapes.shapes, receivedAtMs: attemptedAtMs };
  } catch (pollError) {
    if (pollError instanceof StillPreparingForPollingError) {
      return { ok: false, error: pollError.message, attemptedAtMs };
    }
    if (signal.aborted) {
      return timeoutFailure;
    }
    // An empty message is fine: the store shows its pt-BR fallback instead.
    const error = pollError instanceof Error ? pollError.message : String(pollError);
    return { ok: false, error, attemptedAtMs };
  }
}

/** What recording one result needs. */
export type RecordPollResultOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  sourceId: string;
  pollResult: PollResult;
};

/**
 * Hands one result to the store as the source's poller, and logs what it did to the
 * source: a warning when the poll failed (an adapter error, a timeout, the stale watch,
 * or shapes the store found invalid), an info line when the source went stale or
 * recovered. A store that refuses or throws is logged, never thrown, because this runs
 * from a timer and an error nobody catches would stop the server.
 */
export function recordPollResultOnTheStore(options: RecordPollResultOptions): void {
  const { stateStore, logger, sourceId, pollResult } = options;
  const wasStale = readSourceFromTheStore(stateStore, sourceId)?.status.isStale;
  try {
    const outcome = stateStore.applyCommand(
      { type: 'recordDataSourcePoll', sourceId, result: pollResult },
      buildDataSourcePollerActor(sourceId),
    );
    if (!outcome.ok) {
      logger.warn(
        { source_id: sourceId, error: outcome.error },
        'data source poll result was refused',
      );
      return;
    }
  } catch (recordError) {
    logger.error(
      { err: recordError, source_id: sourceId },
      'data source poll result could not be recorded',
    );
    return;
  }
  const sourceAfter = readSourceFromTheStore(stateStore, sourceId);
  if (sourceAfter === undefined) {
    return;
  }
  // A failed poll, whatever made it fail, leaves the failure counted on the source.
  if (sourceAfter.status.consecutiveFailures > 0) {
    logger.warn(
      { source_id: sourceId, error: sourceAfter.status.lastError },
      'data source poll failed',
    );
  }
  if (wasStale === false && sourceAfter.status.isStale) {
    logger.info({ source_id: sourceId }, 'data source went stale');
  }
  if (wasStale === true && !sourceAfter.status.isStale) {
    logger.info({ source_id: sourceId }, 'data source recovered');
  }
}

/** The source as the store holds it now, or undefined when it was deleted. */
export function readSourceFromTheStore(
  stateStore: StateStore,
  sourceId: string,
): DataSource | undefined {
  return stateStore.readAllSlices().dataSources.find((source) => source.id === sourceId);
}
