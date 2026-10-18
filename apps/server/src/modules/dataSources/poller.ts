import type { DataSource } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { ptBR } from '../../core/messages/ptBR.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import type { DataSourceAdapters } from './adapters/createDataSourceAdapters.js';
import {
  type PollResult,
  pollTheSourceIntoAPollResult,
  readSourceFromTheStore,
  recordPollResultOnTheStore,
} from './pollResultRecording.js';

/** What the poller needs; the clock and the two timer functions default to Node's own. */
export type DataSourcePollerOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** The adapter of each kind of source (see adapters/createDataSourceAdapters.ts). */
  adapters: DataSourceAdapters;
  /** The clock handed to the adapters and used for the stale watch; defaults to real time. */
  readCurrentTime?: (() => Date) | undefined;
  /** Starts a wait and returns something cancelTimer can cancel it with. */
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  /** Cancels a wait started by startTimer. */
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
};

/** The running poller; stop() calls every loop off and stops watching the store. */
export type DataSourcePoller = { stop: () => void };

/**
 * The longest a poll may take, whatever the interval: a source that has not answered in
 * ten seconds is down, and the operator should see it soon (the brief's number).
 */
const longestPollTimeoutInMilliseconds = 10_000;

/**
 * One loop: the polling of one source while it is on. A new object is made every time
 * the source is turned on, so a loop that was stopped can always tell its own late
 * answer apart from the next loop's (the "generation" check is `isStopped`).
 */
type PollingLoop = {
  sourceId: string;
  isStopped: boolean;
  /** The wait before the next poll; undefined while a poll is in flight. */
  nextPollTimerHandle: unknown;
  /** The stale watch's wait, re-armed every poll interval while the loop runs. */
  staleWatchTimerHandle: unknown;
  /** The poll in flight, with what calls it off; undefined between polls. */
  pollInFlight: { abortController: AbortController; timeoutTimerHandle: unknown } | undefined;
  /** When the loop last had a good answer (or started): see the stale watch. */
  lastSuccessfulPollAtMs: number;
  /** The last "Atualizar agora" press seen, so only a new press polls. */
  lastSeenPollNowRequestedAtMs: number | undefined;
  /** The interval the loop's waits were armed with, so an edited interval is noticed. */
  lastSeenPollIntervalMs: number;
};

/**
 * Polls every source that is on, one loop per source, and hands each result, good or
 * failed, to the store as recordDataSourcePoll signed `sistema:fonte:<sourceId>`. The
 * poller never writes state itself; the store validates the shapes.
 *
 * - The loop starts when the source is turned on (or at boot, for a source left on) and
 *   stops when it is turned off or deleted: its poll in flight is signalled and its late
 *   answer dropped. Each poll reads the source from the store, so an edited config
 *   applies from the next poll on. An edited interval restarts the rhythm at once (see
 *   restartTheRhythmWithANewInterval).
 * - Polls never overlap: the next one is armed pollIntervalMs after a poll settles (a
 *   fixed wait, no backoff). "Atualizar agora" (a new pollNowRequestedAtMs) polls at once,
 *   unless a poll is in flight.
 * - A poll is called off after min(pollIntervalMs, 10 s) through the AbortSignal, and
 *   recorded as "Tempo esgotado". The poller does not race the adapter's promise: one
 *   that ignores the signal stays in flight, and the stale watch catches it.
 * - The stale watch: every poll interval, a source whose last good answer is older than
 *   staleAfterMs gets a failure "Sem dados novos há N s", unless it is already stale with
 *   a reason the operator can read. The last good answer is kept here in memory, not
 *   read from lastOkAtMs, because a poll that repeats the stored data is a no-op in the
 *   store and leaves lastOkAtMs where it was (D7). Results are logged on recording.
 *
 * Deliberate trade-off: the first poll of a loop and a "poll now" run from a 0 ms timer,
 * never inside the store's listener, so the command that caused them is fully broadcast
 * before the poll's own result is.
 */
export function startDataSourcePoller(options: DataSourcePollerOptions): DataSourcePoller {
  const { stateStore, logger, adapters } = options;
  const readCurrentTime = options.readCurrentTime ?? (() => new Date());
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  const loopsBySourceId = new Map<string, PollingLoop>();

  /** The source as the store holds it now, or undefined when it was deleted. */
  function readSource(sourceId: string): DataSource | undefined {
    return readSourceFromTheStore(stateStore, sourceId);
  }

  /** Hands one result to the store and logs what it did (see pollResultRecording.ts). */
  function recordPollResult(sourceId: string, pollResult: PollResult): void {
    recordPollResultOnTheStore({ stateStore, logger, sourceId, pollResult });
  }

  /**
   * Runs after every change of the sources: stops the loops of sources turned off or
   * deleted, follows an edited interval, answers a new "Atualizar agora", and starts a
   * loop for each source newly on.
   */
  function followSourcesAfterChange(dataSources: DataSource[]): void {
    for (const loop of [...loopsBySourceId.values()]) {
      const source = dataSources.find((candidate) => candidate.id === loop.sourceId);
      if (source === undefined || !source.isEnabled) {
        stopLoop(loop);
        continue;
      }
      const hasANewPollInterval = source.pollIntervalMs !== loop.lastSeenPollIntervalMs;
      if (hasANewPollInterval) {
        loop.lastSeenPollIntervalMs = source.pollIntervalMs;
        restartTheRhythmWithANewInterval(loop, source.pollIntervalMs);
      }
      const isNewPollNowRequest = source.pollNowRequestedAtMs !== loop.lastSeenPollNowRequestedAtMs;
      if (isNewPollNowRequest) {
        loop.lastSeenPollNowRequestedAtMs = source.pollNowRequestedAtMs;
        pollNowUnlessAPollIsInFlight(loop);
      }
    }
    for (const source of dataSources) {
      const hasALoop = loopsBySourceId.has(source.id);
      if (source.isEnabled && !hasALoop) {
        startLoop(source);
      }
    }
  }

  /** Starts the loop of a source: its first poll from a 0 ms timer, and its stale watch. */
  function startLoop(source: DataSource): void {
    const loop: PollingLoop = {
      sourceId: source.id,
      isStopped: false,
      nextPollTimerHandle: undefined,
      staleWatchTimerHandle: undefined,
      pollInFlight: undefined,
      lastSuccessfulPollAtMs: readCurrentTime().getTime(),
      lastSeenPollNowRequestedAtMs: source.pollNowRequestedAtMs,
      lastSeenPollIntervalMs: source.pollIntervalMs,
    };
    loopsBySourceId.set(source.id, loop);
    armTheNextPoll(loop, 0);
    armTheStaleWatch(loop, source.pollIntervalMs);
  }

  /** Stops a loop: its waits are called off and its poll in flight is signalled. */
  function stopLoop(loop: PollingLoop): void {
    loop.isStopped = true;
    loopsBySourceId.delete(loop.sourceId);
    cancelTimer(loop.nextPollTimerHandle);
    cancelTimer(loop.staleWatchTimerHandle);
    if (loop.pollInFlight !== undefined) {
      cancelTimer(loop.pollInFlight.timeoutTimerHandle);
      loop.pollInFlight.abortController.abort();
    }
  }

  /** "Atualizar agora": the pending wait is replaced by a 0 ms one, unless a poll runs. */
  function pollNowUnlessAPollIsInFlight(loop: PollingLoop): void {
    if (loop.pollInFlight !== undefined) {
      return;
    }
    cancelTimer(loop.nextPollTimerHandle);
    armTheNextPoll(loop, 0);
  }

  /**
   * "Editar" changed the interval, and with it staleAfterMs, while the loop's waits are
   * still armed with the old one. Left alone, the stale watch would compare a gap of the
   * old interval with the new, smaller staleAfterMs and mark a healthy source late. So
   * the rhythm starts again now: the stale clock counts from this moment, the stale
   * watch is re-armed with the new interval, and the source is polled at once (unless a
   * poll is in flight; the next one then follows with the new interval).
   * Trade-off: a source failing quietly has its stale mark put off by one staleAfterMs.
   */
  function restartTheRhythmWithANewInterval(loop: PollingLoop, pollIntervalMs: number): void {
    loop.lastSuccessfulPollAtMs = readCurrentTime().getTime();
    cancelTimer(loop.staleWatchTimerHandle);
    armTheStaleWatch(loop, pollIntervalMs);
    pollNowUnlessAPollIsInFlight(loop);
  }

  /** Arms the wait before the loop's next poll. */
  function armTheNextPoll(loop: PollingLoop, delayInMilliseconds: number): void {
    loop.nextPollTimerHandle = startTimer(() => {
      // Nothing may be thrown from a timer: an error nobody catches stops the server.
      pollOnceThenArmTheNext(loop).catch((unexpectedError: unknown) => {
        logger.error(
          { err: unexpectedError, source_id: loop.sourceId },
          'data source poll crashed',
        );
      });
    }, delayInMilliseconds);
  }

  /**
   * Polls the source once, records the result, and arms the next poll one interval
   * after this one settled. A loop stopped while the poll was in flight drops the result.
   */
  async function pollOnceThenArmTheNext(loop: PollingLoop): Promise<void> {
    loop.nextPollTimerHandle = undefined;
    const source = readSource(loop.sourceId);
    if (loop.isStopped || source === undefined) {
      return;
    }
    const timeoutInMilliseconds = Math.min(source.pollIntervalMs, longestPollTimeoutInMilliseconds);
    const abortController = new AbortController();
    const timeoutTimerHandle = startTimer(() => abortController.abort(), timeoutInMilliseconds);
    loop.pollInFlight = { abortController, timeoutTimerHandle };

    const pollResult = await pollTheSourceIntoAPollResult({
      source,
      adapters,
      readCurrentTime,
      signal: abortController.signal,
      timeoutInMilliseconds,
    });

    cancelTimer(timeoutTimerHandle);
    loop.pollInFlight = undefined;
    if (loop.isStopped) {
      // Turned off, deleted or the server closing while the poll was in flight: this
      // answer belongs to no loop any more, and the store may be closing.
      return;
    }
    if (pollResult.ok) {
      loop.lastSuccessfulPollAtMs = readCurrentTime().getTime();
    }
    recordPollResult(loop.sourceId, pollResult);
    const sourceAfterThePoll = readSource(loop.sourceId);
    if (!loop.isStopped && sourceAfterThePoll !== undefined) {
      armTheNextPoll(loop, sourceAfterThePoll.pollIntervalMs);
    }
  }

  /** Arms the loop's stale watch, which looks again every poll interval. */
  function armTheStaleWatch(loop: PollingLoop, delayInMilliseconds: number): void {
    loop.staleWatchTimerHandle = startTimer(() => watchForNoNewData(loop), delayInMilliseconds);
  }

  /**
   * The stale watch: a source whose last good answer is older than its staleAfterMs is
   * marked late with "Sem dados novos há N s". This is what catches a poll that hangs
   * past its timeout, since such a poll never settles. A source already stale is marked
   * only when it has no reason yet: a restart brings sources back stale with no error,
   * and without this a hung adapter would leave the operator with "atrasada" and no why.
   */
  function watchForNoNewData(loop: PollingLoop): void {
    const source = readSource(loop.sourceId);
    if (loop.isStopped || source === undefined) {
      return;
    }
    const nowMs = readCurrentTime().getTime();
    const millisecondsSinceTheLastGoodPoll = nowMs - loop.lastSuccessfulPollAtMs;
    const isOverdue = millisecondsSinceTheLastGoodPoll > source.status.staleAfterMs;
    const isStaleWithAReason = source.status.isStale && source.status.lastError !== null;
    if (isOverdue && !isStaleWithAReason) {
      const secondsWithoutNewData = Math.floor(millisecondsSinceTheLastGoodPoll / 1_000);
      recordPollResult(loop.sourceId, {
        ok: false,
        error: ptBR.dataSourceErrors.noNewDataFor(secondsWithoutNewData),
        attemptedAtMs: nowMs,
      });
    }
    if (!loop.isStopped) {
      armTheStaleWatch(loop, source.pollIntervalMs);
    }
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    if (changedSliceNames.includes('dataSources')) {
      followSourcesAfterChange(slices.dataSources);
    }
  });
  // Sources left on before a restart start polling again at once.
  followSourcesAfterChange(stateStore.readAllSlices().dataSources);

  return {
    stop: () => {
      stopWatchingTheStore();
      for (const loop of [...loopsBySourceId.values()]) {
        stopLoop(loop);
      }
    },
  };
}

/** The default startTimer: Node's setTimeout. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** The default cancelTimer: Node's clearTimeout, for a handle startNodeTimer returned. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as NodeJS.Timeout | undefined);
}
