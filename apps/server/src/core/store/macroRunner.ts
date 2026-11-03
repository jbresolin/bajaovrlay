import type { MacroRun, MacroStep, MacroStoppedAtStep, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { buildMacroRunnerActor } from './commandActors.js';
import type { StateStore } from './createStateStore.js';
import { startMacroRunWatchdog } from './macroRunWatchdog.js';

/** What the runner needs; the two timer functions default to Node's own. */
export type MacroRunnerOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** Starts a wait and returns something cancelTimer can cancel it with. */
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  /** Cancels a wait started by startTimer. */
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
};

/**
 * The running runner; stop() calls off the pending wait and the watchdog, and stops
 * watching the store.
 */
export type MacroRunner = { stop: () => void };

/**
 * How long the runner waits before sending endMacroRun again after the store threw on
 * it. Long enough for a briefly locked database to free itself, short enough that the
 * operator barely sees the button stay on "Rodando".
 */
const delayBeforeTryingTheEndAgainInMilliseconds = 1_000;

/**
 * The run being carried out: which macro, its steps as they were at the press, the
 * pending timer, and whether the run is waiting before a step (the first step's 0 ms, a
 * wait, or OBS's answer to an obsScene step), which a "Parar" may call off; the retry of
 * an end is never called off. `switchWaitingForObs` is the scene switch an obsScene step
 * sent, by its number, until OBS's answer reaches the `obs` slice.
 */
type RunInProgress = {
  macroId: string;
  steps: MacroStep[];
  timerHandle: unknown;
  isWaitingForTheNextStep: boolean;
  switchWaitingForObs: { number: number; stepIndex: number } | undefined;
};

/**
 * Watches the store and carries out every macro run that runMacro records in the
 * `macroRuns` slice. Each step is sent through stateStore.applyCommand, the single path
 * every command takes, signed `sistema:macro:<macroId>`, so it is validated, authorised,
 * saved, logged and broadcast like any other; the authorisation hook lets that actor
 * send only takeItem, clearLayer, clearAll, switchObsScene and the bookkeeping of its own
 * run.
 *
 * The steps run strictly in order. A `wait` sends nothing and holds the next step back.
 * An `obsScene` step (BAJAOVRLAY-27) sends switchObsScene and holds the next step back
 * until OBS's answer reaches the `obs` slice: done, the run goes on from a 0 ms timer;
 * refused (or OBS down, which the store refuses at once), the run stops there. A graphic
 * after it must never go on air over the wrong scene.
 * Before each step the runner sends advanceMacroRun naming it, so the slice shows the
 * step running now (a wait included), and when the run is over, whatever the outcome,
 * endMacroRun: the `macroRuns` slice only changes through commands.
 *
 * "Parar" (stopMacro) marks the run `isStopRequested`. The runner sends no step after
 * the one in progress: the mark is read before every step, and a wait in progress is
 * called off at once, because a wait puts nothing on air. Then it ends the run with
 * endMacroRun as usual. A run that leaves the slice another way (the watchdog,
 * macroRunWatchdog.ts, started and stopped with the runner) is forgotten at once.
 *
 * Deliberate trade-offs:
 * - A refused step stops the macro there, is logged as a warning, and nothing is rolled
 *   back: what earlier steps put on air stays (on-air state is never undone
 *   automatically). The run's end carries the step and the refusal's pt-BR message, so
 *   the button can say where and why it stopped (`macroStops`, BAJAOVRLAY-27). A step that throws is logged as an error, never thrown. An
 *   endMacroRun that throws is logged and sent again a second later until it goes
 *   through, because a run left behind would lock every macro.
 * - The first step is sent from a timer of 0 ms, not from inside the store's listener,
 *   so the runMacro's own broadcast is finished before the first step's starts. A wait
 *   called off by "Parar" is ended from a 0 ms timer for the same reason.
 * - Nothing is rolled back by "Parar" either: what the run put on air stays.
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
  const watchdog = startMacroRunWatchdog({ stateStore, logger, startTimer, cancelTimer });

  /**
   * Runs after every command that changed the runs. runMacro refuses a second run, so
   * there is at most one: when the runner is not carrying one out and one is there, it
   * is new. When it is carrying one out, the change is either a "Parar" (acted on here
   * only while waiting for the next step; between steps the loop reads the mark) or the
   * run leaving the slice (the runner's own end, or the watchdog's).
   */
  function followRunsAfterChange(slices: Slices): void {
    if (runInProgress === undefined) {
      const newRun = slices.macroRuns[0];
      if (newRun !== undefined) {
        startRun(newRun, slices);
      }
      return;
    }
    const macroId = runInProgress.macroId;
    const listedRun = slices.macroRuns.find((run) => run.macroId === macroId);
    if (listedRun === undefined) {
      forgetRunEndedElsewhere();
      return;
    }
    if (listedRun.isStopRequested && runInProgress.isWaitingForTheNextStep) {
      callTheWaitOffAndEndTheRun(macroId);
    }
  }

  /**
   * The run left the slice: the timer pending for it (a step, a wait, a retry of the
   * end) is called off and the run forgotten, so nothing more is sent for it.
   */
  function forgetRunEndedElsewhere(): void {
    if (runInProgress !== undefined) {
      cancelTimer(runInProgress.timerHandle);
      runInProgress = undefined;
    }
  }

  /** "Parar" during a wait: the wait is called off and the run ended from a 0 ms timer. */
  function callTheWaitOffAndEndTheRun(macroId: string): void {
    if (runInProgress === undefined) {
      return;
    }
    logger.info({ macro_id: macroId }, 'macro stopped by an operator');
    cancelTimer(runInProgress.timerHandle);
    runInProgress.isWaitingForTheNextStep = false;
    // OBS's answer may still come; it no longer moves this run on.
    runInProgress.switchWaitingForObs = undefined;
    runInProgress.timerHandle = startTimer(() => endRun(macroId), 0);
  }

  /** Whether an operator pressed "Parar" for this macro's run, read from the store. */
  function isStopRequestedFor(macroId: string): boolean {
    const listedRun = stateStore.readAllSlices().macroRuns.find((run) => run.macroId === macroId);
    return listedRun?.isStopRequested === true;
  }

  /** Remembers the run and its steps, and sends its first step from a timer of 0 ms. */
  function startRun(run: MacroRun, slices: Slices): void {
    const macro = slices.macros.find((candidate) => candidate.id === run.macroId);
    const steps = macro?.steps ?? [];
    // Remembered before the timer starts, so a timer that fires at once finds the run.
    const startedRun: RunInProgress = {
      macroId: run.macroId,
      steps,
      timerHandle: undefined,
      isWaitingForTheNextStep: true,
      switchWaitingForObs: undefined,
    };
    runInProgress = startedRun;
    startedRun.timerHandle = startTimer(() => runStepsFrom(run.macroId, 0), 0);
  }

  /**
   * Sends the steps from `firstStepIndex` on, one after the other, until a wait, a
   * refusal, a "Parar", or the end. Before each step the "Parar" mark is read, and the
   * run is moved on to the step (advanceMacroRun); for the first step that is the step
   * runMacro recorded, so it changes nothing and leaves no trace. Nothing may be thrown from here: this runs from a timer, where an
   * error nobody catches would stop the whole server, with graphics on air.
   */
  function runStepsFrom(macroId: string, firstStepIndex: number): void {
    let stepIndex = firstStepIndex;
    if (runInProgress?.macroId === macroId) {
      runInProgress.isWaitingForTheNextStep = false;
    }
    try {
      while (!isStopped && runInProgress?.macroId === macroId) {
        if (isStopRequestedFor(macroId)) {
          logger.info({ macro_id: macroId, step_index: stepIndex }, 'macro stopped by an operator');
          endRun(macroId);
          return;
        }
        const step = runInProgress.steps[stepIndex];
        if (step === undefined) {
          endRun(macroId);
          return;
        }
        moveRunOnTo(macroId, stepIndex);
        if (step.kind === 'wait') {
          const indexOfStepAfterTheWait = stepIndex + 1;
          runInProgress.isWaitingForTheNextStep = true;
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
          endRun(macroId, { stepIndex, reason: outcome.error.message });
          return;
        }
        if (step.kind === 'obsScene') {
          waitForObsToAnswerTheSwitch(stepIndex);
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

  /**
   * An obsScene step's switch was accepted: the run waits, with nothing pending, for OBS's
   * answer to that switch (followObsAnswerAfterChange). The switch is the slice's latest,
   * since the store refuses a second while one has no answer.
   */
  function waitForObsToAnswerTheSwitch(stepIndex: number): void {
    if (runInProgress === undefined) {
      return;
    }
    const sceneSwitch = stateStore.readAllSlices().obs.sceneSwitch;
    runInProgress.isWaitingForTheNextStep = true;
    runInProgress.timerHandle = undefined;
    runInProgress.switchWaitingForObs = { number: sceneSwitch?.number ?? 0, stepIndex };
  }

  /**
   * Runs after every change of the `obs` slice. When it carries OBS's answer to the switch
   * the run waits for, the run goes on with the next step, or ends stopped at this one
   * with OBS's reason; either from a 0 ms timer, so no command is sent from inside the
   * store's listener.
   */
  function followObsAnswerAfterChange(slices: Slices): void {
    const switchWaitingForObs = runInProgress?.switchWaitingForObs;
    if (runInProgress === undefined || switchWaitingForObs === undefined) {
      return;
    }
    const sceneSwitch = slices.obs.sceneSwitch;
    const isTheAnswer =
      sceneSwitch !== null &&
      sceneSwitch.number === switchWaitingForObs.number &&
      sceneSwitch.status !== 'enviada';
    if (!isTheAnswer) {
      return;
    }
    const macroId = runInProgress.macroId;
    runInProgress.switchWaitingForObs = undefined;
    if (sceneSwitch.status === 'feita') {
      const indexOfTheNextStep = switchWaitingForObs.stepIndex + 1;
      runInProgress.timerHandle = startTimer(() => runStepsFrom(macroId, indexOfTheNextStep), 0);
      return;
    }
    const stoppedAtStep: MacroStoppedAtStep = {
      stepIndex: switchWaitingForObs.stepIndex,
      reason: sceneSwitch.refusalReason ?? sceneSwitch.sceneName,
    };
    logger.warn(
      { macro_id: macroId, step_index: stoppedAtStep.stepIndex, reason: stoppedAtStep.reason },
      'macro stopped: OBS did not switch the scene',
    );
    runInProgress.timerHandle = startTimer(() => endRun(macroId, stoppedAtStep), 0);
  }

  /** Says which step the run is at now (advanceMacroRun). */
  function moveRunOnTo(macroId: string, stepIndex: number): void {
    stateStore.applyCommand(
      { type: 'advanceMacroRun', macroId, currentStep: stepIndex },
      buildMacroRunnerActor(macroId),
    );
  }

  /**
   * Ends the run in the store (endMacroRun), with the step it stopped at and why when a
   * step was refused, and only then forgets it. When the store throws, the error is
   * logged, never thrown, and the end is tried again a second later, until it goes
   * through or the runner stops: a run left in `macroRuns` would refuse every runMacro
   * until the server restarts. The run stays remembered while the end is pending, so
   * stop() can call the retry off like any wait.
   */
  function endRun(macroId: string, stoppedAtStep?: MacroStoppedAtStep): void {
    const endCommand =
      stoppedAtStep === undefined
        ? { type: 'endMacroRun', macroId }
        : { type: 'endMacroRun', macroId, stoppedAtStep };
    try {
      stateStore.applyCommand(endCommand, buildMacroRunnerActor(macroId));
    } catch (endError) {
      logger.error(
        { err: endError, macro_id: macroId },
        'macro run could not be ended; trying again',
      );
      if (runInProgress !== undefined && !isStopped) {
        runInProgress.timerHandle = startTimer(
          () => endRun(macroId, stoppedAtStep),
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
    if (changedSliceNames.includes('obs')) {
      followObsAnswerAfterChange(slices);
    }
  });

  return {
    stop: () => {
      isStopped = true;
      stopWatchingTheStore();
      watchdog.stop();
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
    case 'obsScene':
      return { type: 'switchObsScene', sceneName: step.sceneName, target: step.target };
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
