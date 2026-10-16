import type { MacroStep, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { macroWatchdogActor } from './commandActors.js';
import type { StateStore } from './createStateStore.js';

/** What the watchdog needs; the macro runner hands it its own store, logger and timers. */
export type MacroRunWatchdogOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** Starts a timer and returns something cancelTimer can cancel it with. */
  startTimer: (onTimeIsUp: () => void, delayInMilliseconds: number) => unknown;
  /** Cancels a timer started by startTimer. */
  cancelTimer: (timerHandle: unknown) => void;
};

/** The running watchdog; stop() calls its timer off and stops watching the store. */
export type MacroRunWatchdog = { stop: () => void };

/**
 * The margin on top of a run's waits. The steps that are not waits are sent at once, so
 * a run that goes 30 s past its waits is stuck, not slow.
 */
const marginOnTopOfTheWaitsInMilliseconds = 30_000;

/** The run being watched: which macro, and the timer that ends it at its limit. */
type WatchedRun = { macroId: string; timerHandle: unknown };

/** A run's time limit: the sum of its macro's waits plus 30 000 ms. */
export function computeMacroRunTimeLimitInMilliseconds(steps: MacroStep[]): number {
  let sumOfTheWaitsInMilliseconds = 0;
  for (const step of steps) {
    if (step.kind === 'wait') {
      sumOfTheWaitsInMilliseconds += step.ms;
    }
  }
  return sumOfTheWaitsInMilliseconds + marginOnTopOfTheWaitsInMilliseconds;
}

/**
 * Watches the `macroRuns` slice and ends any run still listed at its time limit
 * (computeMacroRunTimeLimitInMilliseconds, counted from when the run appeared). The end
 * goes through stateStore.applyCommand as endMacroRun signed `sistema:macro-watchdog`,
 * the one command the authorisation hook lets that actor send, and a warning log line
 * names the macro and the limit. The runner sees the run gone and forgets it.
 *
 * It watches the slice, not the runner: a run leaving the slice (ended by the runner,
 * whatever the outcome) calls its timer off, so a run that ended on time is never ended
 * twice and leaves no timer behind.
 *
 * Deliberate trade-offs:
 * - Nothing is rolled back: what the run put on air stays, as with a refused step.
 * - An endMacroRun from the watchdog that throws is logged as an error and not tried
 *   again: the runner is already retrying its own end every second, and a store that
 *   refuses every write needs a restart anyway.
 */
export function startMacroRunWatchdog(options: MacroRunWatchdogOptions): MacroRunWatchdog {
  const { stateStore, logger, startTimer, cancelTimer } = options;
  let watchedRun: WatchedRun | undefined;

  /** Starts watching a new run, or stops watching one that left the slice. */
  function followRunsAfterChange(slices: Slices): void {
    const listedRun = slices.macroRuns[0];
    const isWatchedRunStillListed =
      watchedRun !== undefined &&
      slices.macroRuns.some((run) => run.macroId === watchedRun?.macroId);
    if (watchedRun !== undefined && !isWatchedRunStillListed) {
      cancelTimer(watchedRun.timerHandle);
      watchedRun = undefined;
    }
    if (watchedRun === undefined && listedRun !== undefined) {
      watchRun(listedRun.macroId, slices);
    }
  }

  /** Starts the timer that ends this macro's run at its limit. */
  function watchRun(macroId: string, slices: Slices): void {
    const macro = slices.macros.find((candidate) => candidate.id === macroId);
    const limitInMilliseconds = computeMacroRunTimeLimitInMilliseconds(macro?.steps ?? []);
    const timerHandle = startTimer(
      () => endRunAtItsLimit(macroId, limitInMilliseconds),
      limitInMilliseconds,
    );
    watchedRun = { macroId, timerHandle };
  }

  /**
   * Ends the run if it is still listed. Runs from a timer, so nothing may be thrown from
   * here: an error nobody catches would stop the whole server, with graphics on air.
   */
  function endRunAtItsLimit(macroId: string, limitInMilliseconds: number): void {
    watchedRun = undefined;
    const isStillRunning = stateStore
      .readAllSlices()
      .macroRuns.some((run) => run.macroId === macroId);
    if (!isStillRunning) {
      return;
    }
    logger.warn(
      { macro_id: macroId, limit_ms: limitInMilliseconds },
      'macro run ended by the watchdog',
    );
    try {
      stateStore.applyCommand({ type: 'endMacroRun', macroId }, macroWatchdogActor);
    } catch (endError) {
      logger.error({ err: endError, macro_id: macroId }, 'the watchdog could not end the run');
    }
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    if (changedSliceNames.includes('macroRuns')) {
      followRunsAfterChange(slices);
    }
  });

  return {
    stop: () => {
      stopWatchingTheStore();
      if (watchedRun !== undefined) {
        cancelTimer(watchedRun.timerHandle);
        watchedRun = undefined;
      }
    },
  };
}
