import type { MacroRun, MacroStep, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { buildMacroRunnerActor } from './commandActors.js';
import type { StateStore } from './createStateStore.js';

/** What the runner needs; the two timer functions default to Node's own. */
export type MacroRunnerOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** Starts a wait and returns something cancelTimer can cancel it with. */
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  /** Cancels a wait started by startTimer. */
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
};

/** The running runner; stop() calls off the pending wait and stops watching the store. */
export type MacroRunner = { stop: () => void };

/**
 * How long the runner waits before sending endMacroRun again after the store threw on
 * it. Long enough for a briefly locked database to free itself, short enough that the
 * operator barely sees the button stay on "Rodando".
 */
const delayBeforeTryingTheEndAgainInMilliseconds = 1_000;

/** The run being carried out: which macro, its steps as they were at the press. */
type RunInProgress = { macroId: string; steps: MacroStep[]; timerHandle: unknown };

/**
 * Watches the store and carries out every macro run that runMacro records in the
 * `macroRuns` slice. Each step is sent through stateStore.applyCommand, the single path
 * every command takes, signed `sistema:macro:<macroId>`, so it is validated, authorised,
 * saved, logged and broadcast like any other; the authorisation hook lets that actor
 * send only takeItem, clearLayer, clearAll and the bookkeeping of its own run.
 *
 * The steps run strictly in order. A `wait` sends nothing and holds the next step back.
 * Before each step the runner sends advanceMacroRun naming it, so the slice shows the
 * step running now (a wait included), and when the run is over, whatever the outcome,
 * endMacroRun: the `macroRuns` slice only changes through commands.
 *
 * Deliberate trade-offs:
 * - A refused step stops the macro there, is logged as a warning, and nothing is rolled
 *   back: what earlier steps put on air stays (on-air state is never undone
 *   automatically). A step that throws is logged as an error, never thrown. An
 *   endMacroRun that throws is logged and sent again a second later until it goes
 *   through, because a run left behind would lock every macro.
 * - The first step is sent from a timer of 0 ms, not from inside the store's listener,
 *   so the runMacro's own broadcast is finished before the first step's starts.
 * - Runs live in memory only, like auto-out waits. stop() (the server closing) calls a
 *   pending wait off and sends nothing more; the run's entry is left in memory, which
 *   is about to go, and the next boot starts with no run. Nothing is resumed, because a
 *   half-run macro resumed minutes later would put graphics on air nobody asked for.
 * - The steps are read once, at the press. updateMacro and deleteMacro of the running
 *   macro are refused by their reducers, so this copy is never out of date.
 */
export function startMacroRunner(options: MacroRunnerOptions): MacroRunner {
  const { stateStore, logger } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  let runInProgress: RunInProgress | undefined;
  let isStopped = false;

  /**
   * Runs after every command that changed the runs. runMacro refuses a second run, so
   * there is at most one: when the runner is not carrying one out and one is there, it
   * is new (the runner's own advanceMacroRun and endMacroRun land here too, and change
   * nothing because a run is in progress, or none is left).
   */
  function followRunsAfterChange(slices: Slices): void {
    if (runInProgress !== undefined) {
      return;
    }
    const newRun = slices.macroRuns[0];
    if (newRun !== undefined) {
      startRun(newRun, slices);
    }
  }

  /** Remembers the run and its steps, and sends its first step from a timer of 0 ms. */
  function startRun(run: MacroRun, slices: Slices): void {
    const macro = slices.macros.find((candidate) => candidate.id === run.macroId);
    const steps = macro?.steps ?? [];
    // Remembered before the timer starts, so a timer that fires at once finds the run.
    const startedRun: RunInProgress = { macroId: run.macroId, steps, timerHandle: undefined };
    runInProgress = startedRun;
    startedRun.timerHandle = startTimer(() => runStepsFrom(run.macroId, 0), 0);
  }

  /**
   * Sends the steps from `firstStepIndex` on, one after the other, until a wait, a
   * refusal, or the end. Before each step the run is moved on to it (advanceMacroRun);
   * for the first step that is the step runMacro recorded, so it changes nothing and
   * leaves no trace. Nothing may be thrown from here: this runs from a timer, where an
   * error nobody catches would stop the whole server, with graphics on air.
   */
  function runStepsFrom(macroId: string, firstStepIndex: number): void {
    let stepIndex = firstStepIndex;
    try {
      while (!isStopped && runInProgress?.macroId === macroId) {
        const step = runInProgress.steps[stepIndex];
        if (step === undefined) {
          endRun(macroId);
          return;
        }
        moveRunOnTo(macroId, stepIndex);
        if (step.kind === 'wait') {
          const indexOfStepAfterTheWait = stepIndex + 1;
          runInProgress.timerHandle = startTimer(
            () => runStepsFrom(macroId, indexOfStepAfterTheWait),
            step.ms,
          );
          return;
        }
        const outcome = stateStore.applyCommand(
          buildCommandOfStep(step),
          buildMacroRunnerActor(macroId),
        );
        if (!outcome.ok) {
          logger.warn(
            { macro_id: macroId, step_index: stepIndex, error: outcome.error },
            'macro stopped at a refused step',
          );
          endRun(macroId);
          return;
        }
        stepIndex += 1;
      }
    } catch (stepError) {
      logger.error(
        { err: stepError, macro_id: macroId, step_index: stepIndex },
        'macro stopped: a step could not be sent',
      );
      endRun(macroId);
    }
  }

  /** Says which step the run is at now (advanceMacroRun). */
  function moveRunOnTo(macroId: string, stepIndex: number): void {
    stateStore.applyCommand(
      { type: 'advanceMacroRun', macroId, currentStep: stepIndex },
      buildMacroRunnerActor(macroId),
    );
  }

  /**
   * Ends the run in the store (endMacroRun) and only then forgets it. When the store
   * throws, the error is logged, never thrown, and the end is tried again a second
   * later, until it goes through or the runner stops: a run left in `macroRuns` would
   * refuse every runMacro until the server restarts. The run stays remembered while
   * the end is pending, so stop() can call the retry off like any wait.
   */
  function endRun(macroId: string): void {
    try {
      stateStore.applyCommand({ type: 'endMacroRun', macroId }, buildMacroRunnerActor(macroId));
    } catch (endError) {
      logger.error(
        { err: endError, macro_id: macroId },
        'macro run could not be ended; trying again',
      );
      if (runInProgress !== undefined && !isStopped) {
        runInProgress.timerHandle = startTimer(
          () => endRun(macroId),
          delayBeforeTryingTheEndAgainInMilliseconds,
        );
      }
      return;
    }
    runInProgress = undefined;
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    if (changedSliceNames.includes('macroRuns')) {
      followRunsAfterChange(slices);
    }
  });

  return {
    stop: () => {
      isStopped = true;
      stopWatchingTheStore();
      if (runInProgress !== undefined) {
        cancelTimer(runInProgress.timerHandle);
        runInProgress = undefined;
      }
    },
  };
}

/** The command a step becomes. A wait never gets here: it sends nothing. */
function buildCommandOfStep(step: Exclude<MacroStep, { kind: 'wait' }>) {
  switch (step.kind) {
    case 'takeItem':
      return { type: 'takeItem', itemId: step.itemId };
    case 'clearLayer':
      return { type: 'clearLayer', layerId: step.layerId };
    case 'clearAll':
      return { type: 'clearAll' };
  }
}

/** The default startTimer: Node's setTimeout. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** The default cancelTimer: Node's clearTimeout, for a handle startNodeTimer returned. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as NodeJS.Timeout);
}
